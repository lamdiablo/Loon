/*
 * 自制 YouTube 去广告核心脚本
 * 包含：强制 JSON 逻辑 + 广告字段清洗
 */

const method = $request.method;
const url = $request.url;
const isRequest = typeof $response === "undefined";

// 1. 【请求阶段】修改 Header，强制 YouTube 返回 JSON
if (isRequest) {
    // 只有 POST 请求才处理
    if (method === "POST") {
        let headers = $request.headers;
        // 修改 Accept 和 Content-Type 告诉服务器我们要 JSON
        // 注意：这并不保证 100% 成功，Google 可能会忽略，但这是唯一简单的办法
        if (headers["Content-Type"]) headers["Content-Type"] = "application/json";
        if (headers["Accept"]) headers["Accept"] = "application/json";
        
        // 移除 Protobuf 相关的标记
        delete headers["X-Goog-Api-Format-Version"];
        
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
        console.log("YT AdBlock: 解析 JSON 失败，服务器可能强制返回了 Protobuf");
        $done({}); // 保持原样返回，避免断网
        return;
    }

    // 通用去广告递归函数
    function removeAds(item) {
        if (!item) return;
        
        // 数组处理
        if (Array.isArray(item)) {
            for (let i = item.length - 1; i >= 0; i--) {
                let subItem = item[i];
                
                // 特征匹配：常见的广告渲染器名称
                let isAd = false;
                if (subItem.adSlotRenderer) isAd = true;
                if (subItem.playerAd) isAd = true;
                if (subItem.merchandiseShelfRenderer) isAd = true; // 商品橱窗
                
                // 检查 Shorts 广告
                if (subItem.reelAdMetadata) isAd = true; 
                if (subItem.reelPlayerOverlayRenderer && subItem.reelPlayerOverlayRenderer.style === "REEL_PLAYER_OVERLAY_STYLE_ADS") isAd = true;

                if (isAd) {
                    item.splice(i, 1); // 删除该项
                } else {
                    removeAds(subItem); // 递归检查子项
                }
            }
        } 
        // 对象处理
        else if (typeof item === 'object') {
            // 针对播放页的具体字段清理
            if (item.playerAds) delete item.playerAds;
            if (item.adPlacements) delete item.adPlacements;
            
            // 遍历所有属性继续递归
            for (let key in item) {
                removeAds(item[key]);
            }
        }
    }

    // 执行清理
    removeAds(obj);

    $done({ body: JSON.stringify(obj) });
}
