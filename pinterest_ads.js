/*
Pinterest 彻底去广告脚本（2026 增强版 - 针对购物/产品广告）
适用于 Loon
过滤 promoted + 购物推荐 + 详情页购物 carousel
*/

let url = $request.url;

// 覆盖所有 resource get 接口（包括首页、搜索、详情页 PinDetailResource 等）
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

  // 主数据路径过滤（Feed 中的 promoted / shopping pins）
  if (obj.resource_response && Array.isArray(obj.resource_response.data)) {
    let originalData = obj.resource_response.data;
    let filteredData = originalData.filter(item => {
      // 经典推广
      if (item.is_promoted === true || item.promoted === true || item.is_promoted_ad === true) {
        filteredCount++;
        return false;
      }
      // 广告元数据
      if (item.ad_meta || item.ads_metadata || item.ads_info || item.promotion || item.promoter) {
        filteredCount++;
        return false;
      }
      // tracking_params 广告 ID
      if (item.tracking_params && (item.tracking_params.ad_id || item.tracking_params.creative_id || item.tracking_params.campaign_id)) {
        filteredCount++;
        return false;
      }
      // 购物/产品 Pin 标志（关键增强：过滤 Etsy/Amazon/Wayfair 等购物推荐）
      if (item.price || item.price_info || item.price_value || item.currency_code || 
          item.buyable || item.is_buyable_pin || item.buyable_product || 
          item.shopping_flags || item.has_shopping_data || 
          item.shop_the_look || item.shop_the_look_items || 
          (item.products && Array.isArray(item.products) && item.products.length > 0) ||
          (item.rich_summary && item.rich_summary.price)) {
        filteredCount++;
        return false;
      }
      // 类型包含购物/广告
      if (item.type && (item.type.includes("promoted") || item.type.includes("ad") || item.type.includes("shopping"))) {
        filteredCount++;
        return false;
      }
      return true;
    });

    // 稳定性保护
    if (filteredData.length < 3 && originalData.length > 8) {
      console.log(`Pinterest 警告：购物过滤过多 (${filteredCount})，保留部分数据避免空白`);
      filteredData = originalData.slice(0, 8); // 保留前8条
      filteredCount = 0;
    } else {
      obj.resource_response.data = filteredData;
      modified = true;
    }
  }

  // 额外处理详情页/推荐中的购物 carousel（直接清空常见购物推荐路径）
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

  // stories / results 等备用路径
  if (obj.resource_response && Array.isArray(obj.resource_response.stories)) {
    obj.resource_response.stories = obj.resource_response.stories.filter(item => !(item.is_promoted || item.price_info));
    modified = true;
  }

  if (modified) {
    body = JSON.stringify(obj);
    console.log(`Pinterest 成功过滤 ${filteredCount} 个广告/购物项（包括详情页 carousel）`);
  }

  $done({ body });
} catch (e) {
  console.log("Pinterest 脚本错误，放行原响应: " + e);
  $done({});
}
