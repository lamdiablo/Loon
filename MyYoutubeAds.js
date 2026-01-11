// ==============================================
//  YouTube AdBlock Core Logic (JavaScript)
// ==============================================

const url = $request.url;
const method = $request.method;
let body = $response.body;

// 如果不是 POST 请求或没有 Body，直接放行
if (method !== "POST" || !body) {
    $done({});
}

// 尝试解析 JSON
let obj = null;
try {
    obj = JSON.parse(body);
} catch (e) {
    // 如果解析失败，说明可能是 Protobuf 二进制数据
    // 在不引入庞大的 protobuf 库的情况下，无法处理二进制
    // 建议：在 Header Rewrite 中强制 User-Agent 或 Accept 为 JSON 格式（但这可能导致 App 异常）
    console.log("YouTube AdBlock: 解析 JSON 失败，可能是 Protobuf 数据");
    $done({});
}

// 核心处理函数
function processYouTube(obj, url) {
    
    // 1. 处理播放页数据 (v1/player) - 主要是视频片头/中插广告
    if (url.includes("/v1/player")) {
        // 删除播放器广告
        if (obj.playerAds) delete obj.playerAds;
        if (obj.adPlacements) delete obj.adPlacements;
        
        // 处理播放响应中的广告字段
        if (obj.playbackTracking) {
            if (obj.playbackTracking.videostatsPlaybackUrl) delete obj.playbackTracking.videostatsPlaybackUrl;
            if (obj.playbackTracking.videostatsDelayplayUrl) delete obj.playbackTracking.videostatsDelayplayUrl;
            if (obj.playbackTracking.ptrackingUrl) delete obj.playbackTracking.ptrackingUrl;
            if (obj.playbackTracking.qoeUrl) delete obj.playbackTracking.qoeUrl;
            if (obj.playbackTracking.atrUrl) delete obj.playbackTracking.atrUrl;
            if (obj.playbackTracking.watchtimeUrl) delete obj.playbackTracking.watchtimeUrl;
        }
    }

    // 2. 处理浏览页/推荐页数据 (v1/browse, v1/next, v1/search) - 主要是信息流广告
    if (url.includes("/v1/browse") || url.includes("/v1/next") || url.includes("/v1/search")) {
        
        // 递归查找并删除广告节点的辅助函数
        function removeAdsFromList(items) {
            if (!items || !Array.isArray(items)) return items;
            
            for (let i = items.length - 1; i >= 0; i--) {
                let item = items[i];
                let isAd = false;

                // 判定逻辑：检查常见的广告特征字段
                // YouTube 经常更换字段名，这里列出最常见的
                if (item.adSlotRenderer) isAd = true;
                if (item.playerAd) isAd = true;
                
                // 检查 promtedSparkles (推广内容)
                if (item.richItemRenderer && item.richItemRenderer.content && item.richItemRenderer.content.adSlotRenderer) {
                    isAd = true;
                }

                // 删除广告项
                if (isAd) {
                    items.splice(i, 1);
                } else {
                    // 如果不是广告，继续递归深入检查 (例如 SectionList)
                    if (item.sectionListRenderer && item.sectionListRenderer.contents) {
                        removeAdsFromList(item.sectionListRenderer.contents);
                    }
                    if (item.itemSectionRenderer && item.itemSectionRenderer.contents) {
                        removeAdsFromList(item.itemSectionRenderer.contents);
                    }
                    if (item.richSectionRenderer && item.richSectionRenderer.content && item.richSectionRenderer.content.richShelfRenderer && item.richSectionRenderer.content.richShelfRenderer.contents) {
                         removeAdsFromList(item.richSectionRenderer.content.richShelfRenderer.contents);
                    }
                }
            }
            return items;
        }

        // 入口：处理 onResponseReceivedActions (通常用于 next/browse 的动态加载)
        if (obj.onResponseReceivedActions) {
            for (let action of obj.onResponseReceivedActions) {
                if (action.appendContinuationItemsAction && action.appendContinuationItemsAction.continuationItems) {
                    removeAdsFromList(action.appendContinuationItemsAction.continuationItems);
                }
                if (action.reloadContinuationItemsCommand && action.reloadContinuationItemsCommand.continuationItems) {
                    removeAdsFromList(action.reloadContinuationItemsCommand.continuationItems);
                }
            }
        }

        // 入口：处理 contents (通常用于初始加载)
        if (obj.contents) {
            if (obj.contents.twoColumnBrowseResultsRenderer && obj.contents.twoColumnBrowseResultsRenderer.tabs) {
                for (let tab of obj.contents.twoColumnBrowseResultsRenderer.tabs) {
                    if (tab.tabRenderer && tab.tabRenderer.content && tab.tabRenderer.content.richGridRenderer && tab.tabRenderer.content.richGridRenderer.contents) {
                        removeAdsFromList(tab.tabRenderer.content.richGridRenderer.contents);
                    }
                }
            }
            if (obj.contents.twoColumnWatchNextResults && obj.contents.twoColumnWatchNextResults.results && obj.contents.twoColumnWatchNextResults.results.results && obj.contents.twoColumnWatchNextResults.results.results.contents) {
                 removeAdsFromList(obj.contents.twoColumnWatchNextResults.results.results.contents);
            }
        }
    }
    
    return obj;
}

// 执行处理
const newBody = processYouTube(obj, url);

// 返回修改后的数据
$done({ body: JSON.stringify(newBody) });
