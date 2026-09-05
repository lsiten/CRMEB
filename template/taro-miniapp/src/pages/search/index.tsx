import { useState } from 'react';
import { Button, Input, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './index.scss';

const SearchPage = () => {
  const [keyword, setKeyword] = useState('');
  const submit = () => { const value = keyword.trim(); if (!value) return; Taro.setStorageSync('crmeb_search_keyword', value); void Taro.switchTab({ url: '/pages/goods/index' }); };
  return <View className='page search-page'><Text className='title'>搜索商品</Text><Input className='search-input' value={keyword} onInput={(event) => setKeyword(event.detail.value)} confirmType='search' onConfirm={submit} placeholder='输入商品名称' /><Button onClick={submit}>搜索</Button></View>;
};

export default SearchPage;
