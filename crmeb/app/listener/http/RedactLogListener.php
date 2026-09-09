<?php
namespace app\listener\http;

use crmeb\utils\SensitiveData;
use think\event\LogWrite;

class RedactLogListener
{
    public function handle(LogWrite $event): void
    {
        $event->log = SensitiveData::redact($event->log);
    }
}
