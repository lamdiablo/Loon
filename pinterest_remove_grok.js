/*
Pinterest 去推广 Pins 修复稳定版
适用于 Loon
优先过滤常见广告字段，避免误伤导致加载失败
*/

let url = $request.url;

// 只针对核心 Feed 接口生效（避免误触其他 API 导致崩溃）
if (!url.includes("resource/") || !url.includes("Resource/get")) {
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

  // 主路径：resource_response.data（最常见，首页/搜索 Feed）
  if (obj.resource_response && Array.isArray(obj.resource_response.data)) {
    let originalData = obj.resource_response.data;
    let filteredData = originalData.filter(item => {
      // 严格广告字段（这些几乎100%是推广）
      if (item.is_promoted === true || item.promoted === true || item.is_promoted_ad === true) {
        filteredCount++;
        return false;
      }
      if (item.ad_meta || item.ads_metadata || item.ads_info || item.promotion) {
        filteredCount++;
        return false;
      }
      // tracking_params 中的广告 ID（捕获隐形推广）
      if (item.tracking_params && (item.tracking_params.ad_id || item.tracking_params.creative_id || item.tracking_params.campaign_id)) {
        filteredCount++;
        return false;
      }
      // 类型明确为广告
      if (item.type && (item.type.includes("promoted") || item.type.includes("ad"))) {
        filteredCount++;
        return false;
      }
      return true;
    });

    // 防止过滤后数组完全为空（可能导致 App 白屏或错误）
    if (filteredData.length === 0 && originalData.length > 0) {
      console.log("Pinterest 脚本：检测到全过滤，保留原数据避免崩溃");
      // 不修改，保留原数据
    } else {
      obj.resource_response.data = filteredData;
      modified = true;
    }
  }

  if (modified) {
    body = JSON.stringify(obj);
    // console.log(`Pinterest 过滤了 ${filteredCount} 个广告项`); // 调试用，可取消注释看日志
  }

  $done({ body });
} catch (e) {
  console.log("Pinterest 脚本解析错误，放行原响应: " + e);
  $done({}); // 出错直接放行，避免返回无效 body 导致 App 崩溃
}
