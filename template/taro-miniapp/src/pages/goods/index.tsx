import { useEffect, useState } from 'react';
import { View, Text, Button, Input } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import type { Product } from '../../services/api';
import { getCategories, getCategoryProducts } from '../../services/catalog';
import type { Category, CatalogSort } from '../../services/catalog';
import { Empty } from '../../components';
import { CommerceImage } from '../../components/commerce-image';
import './index.scss';

export default function GoodsPage() {
  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [categoryId, setCategoryId] = useState(0);
  const [childId, setChildId] = useState(0);
  const [products, setProducts] = useState<readonly Product[]>([]);
  const [keyword, setKeyword] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [categoryFailed, setCategoryFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [categoryRetry, setCategoryRetry] = useState(0);
  const [sort, setSort] = useState<CatalogSort>('default');
  const [pendingCategory, setPendingCategory] = useState(0);
  const current = categories.find((item) => item.id === categoryId);
  useDidShow(() => {
    const category = Taro.getStorageSync<number>('crmeb_diy_category');
    if (Number.isSafeInteger(category) && category > 0) {
      setPendingCategory(category); setKeyword(''); setSearch(''); setPage(1);
      Taro.removeStorageSync('crmeb_diy_category');
    }
    const pending = Taro.getStorageSync<string>('crmeb_search_keyword');
    if (typeof pending === 'string' && pending.trim()) {
      setKeyword(pending.trim()); setSearch(pending.trim()); setPage(1);
      setCategoryId(0); setChildId(0); setPendingCategory(0); setSort('default');
      setRetry((value) => value + 1);
      Taro.removeStorageSync('crmeb_search_keyword');
    }
  });
  useEffect(() => {
    if (!pendingCategory || !categories.length) return;
    const parent = categories.find((entry) => entry.id === pendingCategory || entry.children.some((child) => child.id === pendingCategory));
    if (parent) { setCategoryId(parent.id); setChildId(parent.id === pendingCategory ? 0 : pendingCategory); }
    else { setCategoryId(0); setChildId(0); void Taro.showToast({ title: '该分类已下架', icon: 'none' }); }
    setPendingCategory(0);
  }, [categories, pendingCategory]);
  useEffect(() => {
    let active = true;
    setCategoryFailed(false);
    void getCategories().then((result) => { if (active) setCategories(result); })
      .catch(() => { if (active) setCategoryFailed(true); });
    return () => { active = false; };
  }, [categoryRetry]);
  useEffect(() => {
    let active = true;
    setLoading(true); setFailed(false);
    if (page === 1) setProducts([]);
    void getCategoryProducts({ categoryId: childId || categoryId, keyword: search.trim(), page, ...(sort === 'default' ? {} : { sort }) })
      .then((result) => {
        if (!active) return;
        setProducts((previous) => page === 1 ? result : [...previous, ...result.filter((item) => !previous.some((old) => old.id === item.id))]);
        setMore(result.length === 20);
      })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [categoryId, childId, search, page, retry, sort]);
  const submitSearch = () => { setPage(1); setSearch(keyword.trim()); setRetry((value) => value + 1); };
  const selectSort = (value: CatalogSort) => { setSort(value); setPage(1); };
  const clearSearch = () => { setKeyword(''); setSearch(''); setPage(1); };
  return <View className='page catalog-page'>
    <View className='catalog-heading'><Text className='catalog-title'>商品分类</Text><Text className='catalog-subtitle'>发现生活好物</Text></View>
    <View className='catalog-search'><Input className='catalog-input' value={keyword} onInput={(event) => setKeyword(event.detail.value)} onConfirm={submitSearch} confirmType='search' placeholder='搜索你想要的商品' aria-label='搜索商品' /><Button onClick={submitSearch}>搜索</Button></View>
    {categoryFailed && <Button className='catalog-retry' onClick={() => setCategoryRetry((value) => value + 1)}>分类加载失败，点击重试</Button>}
    {!!search && <View className='catalog-query'><Text>“{search}”的搜索结果</Text><Button onClick={clearSearch}>清除搜索</Button></View>}
    <View className='catalog-layout'>
      <View className='catalog-sidebar'>{[{ id: 0, name: '全部商品' }, ...categories].map((item) => <Button key={item.id} className={categoryId === item.id ? 'active' : ''} onClick={() => { setCategoryId(item.id); setChildId(0); setPage(1); }}>{item.name}</Button>)}</View>
      <View className='catalog-content'>
        <Text className='catalog-section-title'>{current?.name ?? '全部商品'}</Text>
        {!!current?.children.length && <View className='catalog-children'>{[{ id: 0, name: '全部' }, ...current.children].map((child) => <Button key={child.id} className={childId === child.id ? 'active' : ''} onClick={() => { setChildId(child.id); setPage(1); }}>{child.name}</Button>)}</View>}
        <View className='catalog-sort'>
          <Button className={sort === 'default' ? 'selected' : ''} aria-pressed={sort === 'default'} onClick={() => selectSort('default')}>综合</Button>
          <Button className={sort === 'sales' ? 'selected' : ''} aria-pressed={sort === 'sales'} onClick={() => selectSort('sales')}>销量</Button>
          <Button className={sort.startsWith('price') ? 'selected' : ''} aria-pressed={sort.startsWith('price')} onClick={() => selectSort(sort === 'price-asc' ? 'price-desc' : 'price-asc')}>{sort === 'price-asc' ? '价格从低到高' : sort === 'price-desc' ? '价格从高到低' : '价格'}</Button>
        </View>
        {loading && <View role='status' className='catalog-state'>正在加载商品…</View>}
        {failed && page === 1 && <Empty title='商品加载失败' actionLabel='重新加载' onAction={() => setRetry((value) => value + 1)} />}
        {!loading && !failed && products.length === 0 && <Empty title='暂无相关商品' description='换个分类或关键词试试' />}
        {(!loading || page > 1) && <View className='catalog-grid'>{products.map((product) => <Button className='catalog-product' key={product.id} onClick={() => void Taro.navigateTo({ url: `/pages/detail/index?id=${product.id}` })}>
          <CommerceImage className='catalog-image' mode='aspectFill' src={product.image} /><Text className='catalog-name'>{product.name}</Text><Text className='catalog-price'>¥{product.price.toFixed(2)}</Text><Text className='catalog-detail'>查看详情 ›</Text>
        </Button>)}</View>}
        {!loading && !failed && more && <Button className='catalog-more' onClick={() => setPage((value) => value + 1)}>加载更多</Button>}
        {failed && page > 1 && <View className='catalog-state'><Text>更多商品加载失败，已加载商品仍可查看</Text><Button className='catalog-retry' onClick={() => setRetry((value) => value + 1)}>重试加载更多</Button></View>}
        {!loading && !failed && !more && products.length > 0 && <View className='catalog-state'>已显示全部商品</View>}
      </View>
    </View>
  </View>;
}
