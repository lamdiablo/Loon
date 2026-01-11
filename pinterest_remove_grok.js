/*
Pinterest 去推广 Pins 脚本
适用于 Loon
过滤 is_promoted 为 true 的内容，以及其他常见推广字段
*/

let url = $request.url;
if (!url.includes("Resource/get")) {
  $done({});
}

let body = $response.body;
if (!body) {
  $done({});
}

try {
  let obj = JSON.parse(body);
  
  // 主 Feed 数据路径（常见于首页、搜索等）
  if (obj.resource_response && Array.isArray(obj.resource_response.data)) {
    let originalData = obj.resource_response.data;
    let filteredData = originalData.filter(item => {
      // 常见推广标志字段（Pinterest 经常更新，建议根据实际抓包调整）
      if (item.is_promoted === true) return false;
      if (item.promoted === true) return false;
      if (item.is_promoted || item.promoted) return false;
      if (item.ad_meta || item.ads_metadata) return false;
      if (item.promoter || item.promoted_by) return false;
      if (item.type === "promoted_pin" || item.type === "ad") return false;
      if (item.native_ad_data) return false;
      return true;
    });
    
    obj.resource_response.data = filteredData;
    body = JSON.stringify(obj);
  }
  
  // 其他可能的数据路径（部分接口使用 resource.response）
  if (obj.resource && obj.resource.response && Array.isArray(obj.resource.response.data)) {
    let originalData = obj.resource.response.data;
    let filteredData = originalData.filter(item => {
      if (item.is_promoted === true) return false;
      if (item.promoted === true) return false;
      if (item.ad_meta || item.ads_metadata) return false;
      return true;
    });
    obj.resource.response.data = filteredData;
    body = JSON.stringify(obj);
  }
  
  $done({ body });
} catch (e) {
  console.log("Pinterest 去广告脚本错误: " + e);
  $done({});
}
