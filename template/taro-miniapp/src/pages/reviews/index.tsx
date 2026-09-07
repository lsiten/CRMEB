import { useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useReachBottom, useRouter } from '@tarojs/taro';
import { CommerceImage } from '../../components/commerce-image';
import { resolveImageUrl } from '../../services/assets';
import { getProductReviews, getReviewSummary } from '../../services/product-reviews';
import type { ProductReview, ReviewFilter } from '../../services/product-reviews';
import { usePagedResource } from '../../state/paged-resource';
import { useRemoteResource } from '../../state/remote-resource';
import '../order/management.scss';
import './index.scss';

const filters = [{ value: 0, label: '全部', count: 'total' }, { value: 1, label: '好评', count: 'good' }, { value: 2, label: '中评', count: 'normal' }, { value: 3, label: '差评', count: 'poor' }] as const;
function ReviewCard({ review }: Readonly<{ review: ProductReview }>) {
  const urls = review.images.map(resolveImageUrl);
  return <View className='order-panel product-review'>
    <View className='review-identity'><CommerceImage className='review-avatar' src={review.avatar} mode='aspectFill' /><View><Text>{review.nickname}</Text>{review.member && <Text className='review-member'>会员</Text>}<Text className='order-muted'>评分 {review.score} / 5</Text></View></View>
    <Text className='order-muted'>{[review.createdAt, review.spec].filter(Boolean).join(' · ')}</Text>
    <Text className='review-content'>{review.comment}</Text>
    {!!urls.length && <View className='review-photos'>{urls.map((url, index) => <Button key={`${index}-${url}`} aria-label={`预览第 ${index + 1} 张评价图片`} onClick={() => Taro.previewImage({ urls, current: url })}><CommerceImage src={url} mode='aspectFill' /></Button>)}</View>}
    {review.merchantReply && <View className='review-merchant'><Text>商家回复</Text><Text>{review.merchantReply}</Text></View>}
  </View>;
}
function ProductReviews({ productId }: Readonly<{ productId: string }>) {
  const [filter, setFilter] = useState<ReviewFilter>(0);
  const summary = useRemoteResource(() => getReviewSummary(productId));
  const list = usePagedResource(`${productId}-${filter}`, (page) => getProductReviews(productId, filter, page));
  useReachBottom(() => { if (!list.loading && !list.error) void list.loadMore(); });
  return <View className='order-management review-page'>
    <Text className='order-heading'>商品评价</Text>
    {summary.error && <View className='order-alert'><Text>{summary.error}</Text><Button disabled={summary.loading} onClick={() => void summary.reload()}>重试评价统计</Button></View>}
    {summary.loading && !summary.data && <View className='order-panel'>正在加载评价统计…</View>}
    {summary.data && <View className='order-panel review-summary'><Text>评分 <Text className='order-amount'>{summary.data.score}</Text> / 5</Text><Text>好评率 {summary.data.positiveRate}%</Text></View>}
    <View className='review-filters'>{filters.map((item) => <Button key={item.value} className={filter === item.value ? 'order-selected' : ''} aria-label={`${item.label}${filter === item.value ? '，已选中' : ''}`} onClick={() => setFilter(item.value)}>{item.label}{summary.data ? ` (${summary.data[item.count]})` : ''}</Button>)}</View>
    {list.items.map((review) => <ReviewCard key={review.id} review={review} />)}
    {list.error && <View className='order-alert'><Text>{list.error}</Text><Button disabled={list.loading} onClick={() => void list.retry()}>重试加载评价</Button></View>}
    {list.loading && <View className='order-panel'>正在加载评价…</View>}
    {!list.loading && !list.error && !list.items.length && <View className='order-panel order-empty'>暂无此类评价</View>}
    {!!list.items.length && (list.end ? <Text className='order-muted review-end'>已显示全部评价</Text> : <Button disabled={list.loading} onClick={() => void list.loadMore()}>加载更多</Button>)}
  </View>;
}
export default function ReviewsPage() {
  const params = useRouter().params;
  const productId = params['product_id'] ?? params['id'];
  return productId ? <ProductReviews key={productId} productId={productId} /> : <View className='order-management'><Text className='order-heading'>商品评价</Text><View className='order-panel order-empty'><Text>查看商品评价，或前往订单发表评价。</Text><Button onClick={() => Taro.navigateTo({ url: '/pages/order/list?status=review' })}>查看待评价订单</Button></View></View>;
}
