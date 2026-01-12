/*
 * Pinterest 去广告脚本
 * 文件名: pinterest_remove_ads.js
 */

const body = $response.body;
if (!body) {
  $done({});
}

try {
  let json = JSON.parse(body);

  // 递归函数：遍历 JSON 并移除广告字段
  const removeAds = (obj) => {
    if (!obj) return obj;

    // 情况1：如果是数组，进行过滤
    if (Array.isArray(obj)) {
      const filtered = obj.filter((item) => {
        // 核心过滤逻辑：只要包含 is_promoted=true 或类型为 promoted 即视为广告
        if (!item || typeof item !== "object") return true;
        
        const isAd =
          item.is_promoted === true ||
          item.type === "promoted" ||
          item.story_type === "promoted" ||
          (item.ad_data !== undefined && item.ad_data !== null);
          
        return !isAd;
      });
      // 对保留下来的元素继续递归清理（处理嵌套结构）
      return filtered.map(removeAds);
    }

    // 情况2：如果是对象，遍历其属性
    if (typeof obj === "object") {
      for (const key in obj) {
        // 移除特定的广告相关垃圾字段
        if (
          key === "ads_insertion" ||
          key === "promoted_pin" ||
          key === "upsell_module"
        ) {
          delete obj[key];
          continue;
        }
        // 递归处理子属性
        obj[key] = removeAds(obj[key]);
      }
    }
    return obj;
  };

  // 处理入口：Pinterest API 返回结构通常在 data 或 resource_response 中
  if (json.data) {
    json.data = removeAds(json.data);
  } else if (json.resource_response) {
    json.resource_response = removeAds(json.resource_response);
  } else {
    // 兜底：尝试直接处理整个对象
    json = removeAds(json);
  }

  $done({ body: JSON.stringify(json) });
} catch (e) {
  console.log("Pinterest Remove Ads Error: " + e);
  $done({});
}
