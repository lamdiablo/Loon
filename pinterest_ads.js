/*
Pinterest 去推广 Pins 详细优化版（2026 稳定彻底版）
适用于 Loon
覆盖更多接口与字段，平衡彻底性与稳定性
*/

let url = $request.url;

// 放宽匹配：所有 resource get 接口（覆盖首页、搜索、看板等 Feed）
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

  // 主路径：resource_response.data（最常见）
  if (obj.resource_response && Array.isArray(obj.resource_response.data)) {
    let originalData = obj.resource_response.data;
    let filteredData = originalData.filter(item => {
      // 明确推广标志（核心）
      if (item.is_promoted === true || 
          item.promoted === true || 
          item.is_promoted_ad === true || 
          item.promoted_is_removable === true) {
        filteredCount++;
        return false;
      }

      // 其他广告元数据
      if (item.ad_meta || 
          item.ads_metadata || 
          item.ads_info || 
          item.ads_tracking_info || 
          item.promotion || 
          item.promoter || 
          item.promoted_by) {
        filteredCount++;
        return false;
      }

      // tracking_params 中的广告 ID（隐形推广常见来源）
      if (item.tracking_params && 
          (item.tracking_params.ad_id || 
           item.tracking_params.creative_id || 
           item.tracking_params.campaign_id || 
           item.tracking_params.upid || 
           item.tracking_params.promoted_pin_id)) {
        filteredCount++;
        return false;
      }

      // 类型或子对象明确为广告/推广
      if (item.type && (item.type.includes("promoted") || item.type.includes("ad") || item.type === "shopping_ad")) {
        filteredCount++;
        return false;
      }
      if (item.native_ad_data || item.shopping_ad_data || item.product_promotion) {
        filteredCount++;
        return false;
      }

      // 富摘要中的推广（部分购物广告）
      if (item.rich_metadata && item.rich_metadata.is_promoted) {
        filteredCount++;
        return false;
      }

      return true;
    });

    // 稳定性：如果过滤太多导致数组近空，保留至少 5 条原数据（避免加载失败）
    if (filteredData.length < 5 && originalData.length > 10) {
      console.log(`Pinterest 脚本警告：过滤过多 (${filteredCount})，保留部分原数据避免空白`);
      filteredData = originalData.slice(0, 10); // 保留前10条，包含可能广告但至少能加载
      filteredCount = 0;
    } else {
      obj.resource_response.data = filteredData;
      modified = true;
    }
  }

  // 额外路径处理（stories、results 等，部分视频/相关推荐广告）
  if (obj.resource_response && Array.isArray(obj.resource_response.stories)) {
    obj.resource_response.stories = obj.resource_response.stories.filter(item => !(item.is_promoted === true || (item.tracking_params && item.tracking_params.ad_id)));
    modified = true;
  }
  if (obj.resource_response && obj.resource_response.results && Array.isArray(obj.resource_response.results)) {
    obj.resource_response.results = obj.resource_response.results.filter(item => !(item.is_promoted === true));
    modified = true;
  }

  if (modified) {
    body = JSON.stringify(obj);
    console.log(`Pinterest 成功过滤 ${filteredCount} 个广告项`);
  }

  $done({ body });
} catch (e) {
  console.log("Pinterest 脚本错误，放行原响应: " + e);
  $done({}); // 错误直接放行，避免 App 崩溃
}
