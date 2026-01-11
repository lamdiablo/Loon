/*
 * 文件名: my_yt_ads.js
 * 功能: 强制 YouTube 返回 JSON 格式并清洗广告数据
 */

const method = $request.method;
const isRequest = typeof $response === "undefined";

// 1. 【请求阶段】修改 Header，强制 YouTube 返回 JSON
if (isRequest) {
    // 只有 POST 请求才处理
    if (method === "POST") {
        let headers = $request.headers;
        
        // 告诉服务器我们要 JSON，不要 Protobuf
        // 注意：这是关键步骤，如果服务器忽略此 Header，脚本将失效
        headers["Accept"] = "application/json";
        headers["Content-Type"] = "application/json";
        
        // 移除 Protobuf 版本标记，防止服务器识别为 App 客户端
        if (headers["X-Goog-Api-Format-Version"]) delete headers["X-Goog-Api-Format-Version"];
        if (headers["x-goog-api-format-version"]) delete headers["x-goog-api-format-version"];
        
        $done({ headers: headers });
    } else {
        $done({});
    }
}

// 2. 【响应阶段】清洗广告数据
else {
    let body = $response.body;
    if (!body) { $done({}); return; }

    let obj = null;
    try {
        obj = JSON.parse(body);
    } catch (e) {
        // 如果解析失败，说明 Header 修改未生效，服务器强制返回了二进制数据
        console.log("YT AdBlock: 解析 JSON 失败，保持原样返回");
        $done({}); 
        return;
    }

    // 递归去广告函数
    function removeAds(item) {
        if (!item) return;
        
        // 处理数组
        if (Array.isArray(item)) {
            for (let i = item.length - 1; i >= 0; i--) {
                let subItem = item[i];
                let isAd = false;
                
                // --- 广告特征匹配 ---
                if (subItem.adSlotRenderer) isAd = true;
                if (subItem.playerAd) isAd = true;
                if (subItem.merchandiseShelfRenderer) isAd = true; // 商品橱窗
                
                // Shorts 广告特征
                if (subItem.reelAdMetadata) isAd = true; 
                if (subItem.reelPlayerOverlayRenderer && subItem.reelPlayerOverlayRenderer.style === "REEL_PLAYER_OVERLAY_STYLE_ADS") isAd = true;

                // 推广内容/付费内容特征
                if (subItem.richItemRenderer && subItem.richItemRenderer.content && subItem.richItemRenderer.content.adSlotRenderer) isAd = true;

                if (isAd) {
                    item.splice(i, 1); // 删除广告项
                } else {
                    removeAds(subItem); // 递归检查子项
                }
            }
        } 
        // 处理对象
        else if (typeof item === 'object') {
            // 播放页特定广告字段
            if (item.playerAds) delete item.playerAds;
            if (item.adPlacements) delete item.adPlacements;
            
            // 遍历属性继续递归
            for (let key in item) {
                removeAds(item[key]);
            }
        }
    }

    // 执行清理
    removeAds(obj);

    // 返回修改后的 JSON
    $done({ body: JSON.stringify(obj) });
}
