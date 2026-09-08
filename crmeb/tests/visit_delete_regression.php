<?php

require dirname(__DIR__) . '/vendor/autoload.php';
require dirname(__DIR__) . '/vendor/topthink/framework/src/helper.php';

use app\api\controller\v1\user\UserController;
use app\dao\product\product\StoreProductLogDao;
use app\Request;
use app\services\product\product\StoreProductLogServices;
use crmeb\utils\Json;
use think\Container;
use think\DbManager;

// Keep translation and application boot isolated from deployed configuration.
function getLang($message, array $replace = [])
{
    return $message;
}

class VisitTestDao extends StoreProductLogDao
{
    public $connection;

    protected function getModel()
    {
        return $this->connection->table('store_product_log');
    }
}

function check($condition, $message)
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

Container::setInstance(new \think\App());
Container::getInstance()->instance('json', new Json());
$db = new DbManager();
$db->setConfig(['default' => 'test', 'connections' => ['test' => [
    'type' => 'sqlite', 'database' => ':memory:', 'fields_strict' => true, 'trigger_sql' => false,
]]]);
$connection = $db->connect();
$connection->execute('CREATE TABLE store_product_log (id INTEGER PRIMARY KEY, uid INTEGER, product_id INTEGER, type TEXT)');
$fixtures = [
    ['id' => 1, 'uid' => 7, 'product_id' => 101, 'type' => 'visit'],
    ['id' => 2, 'uid' => 7, 'product_id' => 101, 'type' => 'visit'],
    ['id' => 3, 'uid' => 8, 'product_id' => 101, 'type' => 'visit'],
    ['id' => 4, 'uid' => 7, 'product_id' => 102, 'type' => 'visit'],
];
foreach (['cart', 'collect', 'order', 'pay', 'refund'] as $offset => $type) {
    $fixtures[] = ['id' => 5 + $offset, 'uid' => 7, 'product_id' => 101, 'type' => $type];
}
$connection->table('store_product_log')->insertAll($fixtures);
$dao = new VisitTestDao();
$dao->connection = $connection;
$service = new StoreProductLogServices($dao);
$controller = (new ReflectionClass(UserController::class))->newInstanceWithoutConstructor();
$invoke = function (array $body, int $uid = 7) use ($controller, $service) {
    $request = new Request();
    $request->withServer(['REQUEST_METHOD' => 'DELETE', 'CONTENT_TYPE' => 'application/json']);
    $request->withHeader(['content-type' => 'application/json']);
    $request->withInput(json_encode(array_merge(['test' => true], $body)));
    $request->macro('uid', function () use ($uid) { return $uid; });
    return $controller->visitDelete($request, $service)->getData();
};
$remaining = function () use ($connection) {
    return array_map('intval', $connection->table('store_product_log')->order('id')->column('id'));
};
$original = $remaining();
$invalid = [101, '101', '101,102', false, 1.5, [[101]], [0], [-1], [true], [1.5],
    ['1e2'], ['101x'], [' 101'], ['01'], ['9223372036854775808'], [101, 'bad'], ['key' => 101]];
foreach ($invalid as $ids) {
    $result = $invoke(['ids' => $ids]);
    check($result === ['status' => 400, 'msg' => '参数错误'], 'Invalid ids accepted: ' . json_encode($ids));
    check($remaining() === $original, 'Invalid request changed rows');
}
foreach ([[], ['ids' => []]] as $body) {
    check($invoke($body) === ['status' => 200, 'msg' => '删除成功'], 'Empty compatibility changed');
    check($remaining() === $original, 'Empty request deleted rows');
}
check($invoke(['ids' => [101]], 0)['status'] === 400, 'Zero uid accepted');
check($remaining() === $original, 'Zero uid deleted rows');
$body = ['ids' => [101, '101', 999], 'uid' => 8, 'type' => 'pay'];
check($invoke($body) === ['status' => 200, 'msg' => '删除成功'], 'Success envelope changed');
check($remaining() === [3, 4, 5, 6, 7, 8, 9], 'User/type/product isolation failed');
check($invoke($body)['status'] === 200, 'Repeated deletion failed');
check($remaining() === [3, 4, 5, 6, 7, 8, 9], 'Repeated deletion changed other rows');
echo "PASS: invalid IDs, empty compatibility, uid guard, user/type/product isolation, duplicate/missing IDs, repeat deletion\n";
