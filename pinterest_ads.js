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
          (item.attribution.provider_name.toLowerCase().includes("perigold") || 
           item.attribution.provider_name.toLowerCase().includes("redbubble") || 
           item.attribution.provider_name.toLowerCase().includes("etsy") || 
           item.attribution.provider_name.toLowerCase().includes("amazon") || 
           item.attribution.provider_name.toLowerCase().includes("wayfair"))) {
        filteredCount++;
        return false;
      }
      // 价格/购物表面数据
      if (item.price_info || item.price_value || item.shopping_surface_data || item.shop_the_look) {
        filteredCount++;
        return false;
      }

      return true;
    });

    // 稳定性：仅当过滤过多时保留部分（避免 Feed 空白）
    if (filteredData.length < 5 && originalData.length > 15) {
      console.log(`Pinterest 警告：瀑布流过滤过多 (${filteredCount})，保留部分数据避免空白`);
      filteredData = originalData.slice(0, 12);
      filteredCount = 0;
    } else {
      obj.resource_response.data = filteredData;
      modified = true;
    }
  }

  // 详情页购物 carousel 清空（保持不动，彻底移除）
  if (obj.resource_response) {
    if (Array.isArray(obj.resource_response.shopping_carousel)) {
      filteredCount += obj.resource_response.shopping_carousel.length;
      obj.resource_response.shopping_carousel = [];
      modified = true;
    }
    if (Array.isArray(obj.resource_response.merchandising_pins)) {
      filteredCount += obj.resource_response.merchandising_pins.length;
      obj.resource_response.merchandising_pins = [];
      modified = true;
    }
    if (Array.isArray(obj.resource_response.visual_annotation_products) || Array.isArray(obj.resource_response.similar_products)) {
      filteredCount += (obj.resource_response.visual_annotation_products || obj.resource_response.similar_products || []).length;
      obj.resource_response.visual_annotation_products = [];
      obj.resource_response.similar_products = [];
      modified = true;
    }
    if (Array.isArray(obj.resource_response.shopping_recommendations)) {
      filteredCount += obj.resource_response.shopping_recommendations.length;
      obj.resource_response.shopping_recommendations = [];
      modified = true;
    }
  }

  if (modified) {
    body = JSON.stringify(obj);
    console.log(`Pinterest 成功过滤 ${filteredCount} 个广告/购物项（重点瀑布流商家 Pin）`);
  }

  $done({ body });
} catch (e) {
  console.log("Pinterest 脚本错误，放行原响应: " + e);
  $done({});
}
