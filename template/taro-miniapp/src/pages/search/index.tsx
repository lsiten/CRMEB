import { useState } from 'react';
import { Button, Input, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './index.scss';

const SearchPage = () => {
  const [keyword, setKeyword] = useState('');
  return <View className='page search-page'><Text className='title'>搜索商品</Text><Input className='search-input' value={keyword} onInput={(event) => setKeyword(event.detail.value)} confirmType='search' onConfirm={() => { if (keyword.trim()) Taro.redirectTo({ url: `/pages/goods/index?keyword=${encodeURIComponent(keyword.trim())}` }); }} placeholder='输入商品名称' /><Button onClick={() => { if (keyword.trim()) Taro.redirectTo({ url: `/pages/goods/index?keyword=${encodeURIComponent(keyword.trim())}` }); }}>搜索</Button></View>;
};

export default SearchPage;
