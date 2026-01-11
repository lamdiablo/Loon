/*
Pinterest 去推广 Pins 优化脚本（2026 版）
适用于 Loon
更彻底过滤 promoted / ad / shopping ad 等内容
添加了 tracking_params 中的 ad_id / creative_id 判断（常见于残留广告）
*/

let url = $request.url;
if (!url.includes("/resource/") && !url.includes("/v3/") && !url.includes("/v5/")) {
  $done({});
}

let body = $response.body;
if (!body) {
  $done({});
}

try {
  let obj = JSON.parse(body);
  
  // 处理主数据路径：resource_response.data（最常见）
  if (obj.resource_response && Array.isArray(obj.resource_response.data)) {
    let originalData = obj.resource_response.data;
    let filteredCount = 0;
    let filteredData = originalData.filter(item => {
      // 核心推广标志
      if (item.is_promoted === true || item.promoted === true || item.is_promoted_ad === true) {
        filteredCount++;
        return false;
      }
      // 其他常见广告字段
      if (item.ad_meta || item.ads_metadata || item.ads_info || item.promotion || item.promoter || item.promoted_by) {
        filteredCount++;
        return false;
      }
      // tracking_params 中含有广告专属 ID（能捕获部分隐形推广）
      if (item.tracking_params && (item.tracking_params.ad_id || item.tracking_params.creative_id || item.tracking_params.campaign_id || item.tracking_params.upid)) {
        filteredCount++;
        return false;
      }
      // 类型为广告
      if (item.type === "promoted_pin" || item.type === "ad" || item.type === "promoted" || item.type === "shopping_ad" || item.type === "native_ad") {
        filteredCount++;
        return false;
      }
      // 其他购物/推广相关（可选强烈过滤，如果内容变少可注释掉下面两行）
      if (item.native_ad_data || item.shopping_data || item.product_group_promotion) {
        filteredCount++;
        return false;
      }
      return true;
    });
    
    obj.resource_response.data = filteredData;
    // 可选：打印过滤数量，便于调试（Loon 日志可见）
    // console.log(`Pinterest 过滤了 ${filteredCount} 个广告项`);
  }
  
  // 处理备用路径：resource.response.data 或 resource.data
  if (obj.resource && obj.resource.response && Array.isArray(obj.resource.response.data)) {
    obj.resource.response.data = obj.resource.response.data.filter(item => !(
      item.is_promoted === true || 
      item.promoted === true || 
      (item.tracking_params && (item.tracking_params.ad_id || item.tracking_params.creative_id))
    ));
  }
  
  // 处理 stories 或 results 等嵌套数组（部分视频/推荐广告）
  if (obj.resource_response && Array.isArray(obj.resource_response.stories)) {
    obj.resource_response.stories = obj.resource_response.stories.filter(item => !(item.is_promoted === true));
  }
  if (obj.resource_response && obj.resource_response.results && Array.isArray(obj.resource_response.results)) {
    obj.resource_response.results = obj.resource_response.results.filter(item => !(item.is_promoted === true));
  }
  
  body = JSON.stringify(obj);
  $done({ body });
} catch (e) {
  console.log("Pinterest 去广告脚本错误: " + e);
  $done({});
}
