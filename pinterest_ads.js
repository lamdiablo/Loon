/*
Pinterest 彻底去广告脚本（2026 瀑布流优化版）
适用于 Loon
重点过滤 Feed 瀑布流中的购物/商家 Pin（如 Perigold、Redbubble）
详情页 carousel 保持原清除逻辑
*/

let url = $request.url;

// 覆盖所有 resource get 接口（首页/搜索 Feed + 详情页）
if (!url.includes("/resource/") || !url.toLowerCase().includes("get")) {
  $done({});
}

let body = $response.body;
if (!body) {
  $done({});
}

try {
  let obj = JSON.parse(body);
  let modified = false;
  let filteredCount = 0;

  // 主数据路径：Feed 瀑布流过滤（增强购物 Pin）
  if (obj.resource_response && Array.isArray(obj.resource_response.data)) {
    let originalData = obj.resource_response.data;
    let filteredData = originalData.filter(item => {
      // 经典推广
      if (item.is_promoted === true || item.promoted === true || item.is_promoted_ad === true) {
        filteredCount++;
        return false;
      }
      // 广告元数据
      if (item.ad_meta || item.ads_metadata || item.ads_info || item.promotion) {
        filteredCount++;
        return false;
      }
      // tracking_params 广告 ID
      if (item.tracking_params && (item.tracking_params.ad_id || item.tracking_params.creative_id || item.tracking_params.campaign_id)) {
        filteredCount++;
        return false;
      }

      // 【关键增强：瀑布流购物 Pin 过滤】
      // 聚合购物数据（Perigold/Redbubble 等商家 Pin 几乎都有此字段）
      if (item.aggregated_pin_data || 
          (item.aggregated_pin_data && (item.aggregated_pin_data.commerce_data || item.aggregated_pin_data.product_data))) {
        filteredCount++;
        return false;
      }
      // 商业/可购买标志
      if (item.commerce_product_info || item.buyable_product_info || item.product_pin_data ||
          item.is_buyable_pin || item.buyable || item.has_shopping_data) {
        filteredCount++;
        return false;
      }
      // 域名商业标志或商家 attribution
      if (item.domain_meta && item.domain_meta.is_commerce === true) {
        filteredCount++;
        return false;
      }
      if (item.attribution && item.attribution.provider_name && 
          (item.attribution.provider_name
