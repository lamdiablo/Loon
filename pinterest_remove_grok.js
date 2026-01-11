/*
Pinterest 去推广 Pins 脚本
适用于 Loon
过滤 is_promoted 为 true 的内容
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
  
  if (obj.resource_response && Array.isArray(obj.resource_response.data)) {
    let originalData = obj.resource_response.data;
    let filteredData = originalData.filter(item => {
      // 过滤推广内容（常见字段）
      if (item.is_promoted === true) return false;
      if (item.promoted === true) return false;
      if (item.is_promoted || item.promoted) return false;
      if (item.ad_meta || item.ads_metadata) return false;
      // 如果有 promoter 信息，也视为推广
      if (item.promoter || item.promoted_by) return false;
      return true;
    });
    
    obj.resource_response.data = filteredData;
    body = JSON.stringify(obj);
  }
  
  $done({ body });
} catch (e) {
  console.log("Pinterest 脚本错误: " + e);
  $done({});
}
