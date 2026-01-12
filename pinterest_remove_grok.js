/*
Pinterest 彻底去广告脚本（2026 终极版 - 基于全部最新抓包）
适用于 Loon
完美去除瀑布流购物 Pin + 详情页 carousel + 相关购物模块
*/

let url = $request.url;

// 覆盖所有主要接口（Feed + 详情 + carousel + related）
if (!url.includes("/resource/") && !url.includes("/v3/") && !url.includes("/get")) {
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
  let filterReason = "";

  // 特殊接口1：购物 carousel（v3_get_stela_shopping_carousel） - 直接清空
  if (obj.endpoint_name === "v3_get_stela_shopping_carousel" && Array.isArray(obj.data)) {
    filteredCount += obj.data.length;
    obj.data = [];
    modified = true;
    filterReason = "购物 carousel 模块";
  }

  // 特殊接口2：相关模块（v3_related_modules_for_pin） - 清空购物 objects
  if (obj.endpoint_name === "v3_related_modules_for_pin" && Array.isArray(obj.data)) {
    obj.data = obj.data.filter(module => {
      if (module.objects && Array.isArray(module.objects)) {
        let origLen = module.objects.length;
        module.objects = module.objects.filter(item => {
          if (item.rich_summary && item.rich_summary.products && item.rich_summary.products.length > 0) {
            return false;
          }
          return true;
        });
        filteredCount += (origLen - module.objects.length);
      }
      return true;
    });
    modified = true;
    filterReason = "相关购物模块";
  }

  // 主 Feed / 单个 Pin / 瀑布流过滤（resource_response.data 或 data）
  let dataArray = null;
  if (obj.resource_response && Array.isArray(obj.resource_response.data)) {
    dataArray = obj.resource_response.data;
  } else if (Array.isArray(obj.data)) {
    dataArray = obj.data;
  }

  if (dataArray) {
    let originalData = dataArray;
    let filteredData = originalData.filter(item => {
      let isShoppingAd = false;

      // 购物 Pin 核心标志（基于抓包 100% 命中）
      if (item.shopping_flags && Array.isArray(item.shopping_flags) && item.shopping_flags.length > 0) {
        isShoppingAd = true;
      }
      if (item.aggregated_pin_data) {
        isShoppingAd = true;
      }
      if (item.rich_summary && item.rich_summary.products && Array.isArray(item.rich_summary.products) && item.rich_summary.products.length > 0) {
        isShoppingAd = true;
      }

      // 经典推广备份
      if (item.is_promoted === true || item.promoted === true || 
          item.ad_meta || item.ads_metadata || item.promotion) {
        isShoppingAd = true;
      }
      if (item.tracking_params && (item.tracking_params.ad_id || item.tracking_params.creative_id)) {
        isShoppingAd = true;
      }

      if (isShoppingAd) {
        filteredCount++;
        return false;
      }
      return true;
    });

    // 稳定性保护
    if (filteredData.length < 5 && originalData.length > 15) {
      console.log(`Pinterest 警告：过滤过多 (${filteredCount})，保留部分数据避免空白`);
      filteredData = originalData.slice(0, 12);
      filteredCount = 0;
    } else {
      if (obj.resource_response) {
        obj.resource_response.data = filteredData;
      } else {
        obj.data = filteredData;
      }
      modified = true;
      filterReason = "瀑布流/Feed 购物 Pin";
    }
  }

  // 额外清空可能的 carousel 路径（双保险）
  if (obj.resource_response) {
    ["shopping_carousel", "merchandising_pins", "visual_annotation_products", "similar_products", "shopping_recommendations"].forEach(key => {
      if (Array.isArray(obj.resource_response[key])) {
        filteredCount += obj.resource_response[key].length;
        obj.resource_response[key] = [];
        modified = true;
      }
    });
  }

  if (modified) {
    body = JSON.stringify(obj);
    console.log(`Pinterest 成功过滤 ${filteredCount} 个广告/购物项（${filterReason}）`);
  }

  $done({ body });
} catch (e) {
  console.log("Pinterest 脚本错误，放行原响应: " + e);
  $done({});
}
