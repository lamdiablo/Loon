/*
 * YouTube AdBlock Local Script
 * 功能：移除 YouTube 首页、播放页、搜索页广告及 Shorts 干扰
 * 核心逻辑：递归遍历 JSON 结构，剔除广告字段
 */

const url = $request.url;
let body = $response.body;
let obj = null;

// 1. 安全防护：确保数据为 JSON 格式，忽略 Protobuf 二进制数据
// 如果 YouTube 强制返回 Protobuf，此脚本将直接返回原始内容以防报错
if (!body |

| body.indexOf('{')!== 0) {
    $done({});
} else {
    try {
        obj = JSON.parse(body);
        
        // 2. 路由分发处理
        if (url.includes('player')) {
            processPlayer(obj);
        } else if (url.includes('browse')) {
            processBrowse(obj);
        } else if (url.includes('next')) {
            processNext(obj);
        } else if (url.includes('search')) {
            processSearch(obj);
        } else if (url.includes('guide')) {
            processGuide(obj);
        }

        // 3. 返回处理后的数据
        $done({ body: JSON.stringify(obj) });
    } catch (e) {
        console.log("YouTube AdBlock Script Error: " + e);
        $done({});
    }
}

// --- 处理函数定义 ---

// 处理播放页 (Player) - 核心去广告
function processPlayer(obj) {
    if (obj.adPlacements) delete obj.adPlacements;
    if (obj.playerAds) delete obj.playerAds;
    if (obj.playbackTracking) {
        // 破坏广告埋点，避免“虚假缓冲”
        if (obj.playbackTracking.videostatsPlaybackUrl) delete obj.playbackTracking.videostatsPlaybackUrl;
        if (obj.playbackTracking.ptrackingUrl) delete obj.playbackTracking.ptrackingUrl;
    }
}

// 处理首页和频道页 (Browse)
function processBrowse(obj) {
    if (obj.contents && obj.contents.twoColumnBrowseResultsRenderer) {
        let tabs = obj.contents.twoColumnBrowseResultsRenderer.tabs;
        if (tabs) {
            tabs.forEach(tab => {
                if (tab.tabRenderer && tab.tabRenderer.content) {
                    cleanSectionList(tab.tabRenderer.content.sectionListRenderer);
                }
            });
        }
    }
}

// 处理推荐列表 (Next)
function processNext(obj) {
    if (obj.contents && obj.contents.twoColumnWatchNextResults) {
        let results = obj.contents.twoColumnWatchNextResults.results;
        if (results && results.results && results.results.contents) {
            // 过滤推荐列表中的广告项
            results.results.contents = results.results.contents.filter(item => {
                return!item.promotedSparklesWebRenderer;
            });
        }
    }
}

// 处理搜索结果 (Search)
function processSearch(obj) {
    if (obj.contents && obj.contents.twoColumnSearchResultsRenderer) {
        let section = obj.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer;
        cleanSectionList(section);
    }
}

// 处理侧边栏 (Guide)
function processGuide(obj) {
    if (obj.items) {
        // 移除“推广”Tab
        obj.items = obj.items.filter(item =>!item.guideEntryRenderer ||!item.guideEntryRenderer.icon |

| item.guideEntryRenderer.icon.iconType!== "AD_OUTLINE");
    }
}

// 通用清洗函数：遍历 SectionList 并移除广告 Item
function cleanSectionList(sectionList) {
    if (!sectionList ||!sectionList.contents) return;
    
    sectionList.contents = sectionList.contents.filter(section => {
        // 移除 Promoted (推广) 板块
        if (section.promotedItemRenderer |

| section.promotedVideoRenderer) return false;
        
        // 深入 ItemSection 清洗
        if (section.itemSectionRenderer && section.itemSectionRenderer.contents) {
            section.itemSectionRenderer.contents = section.itemSectionRenderer.contents.filter(item => {
                return!item.promotedVideoRenderer && 
                      !item.adSlotRenderer &&
                      !item.promotedSparklesWebRenderer;
            });
            // 如果清洗后该板块为空，则移除整个板块
            return section.itemSectionRenderer.contents.length > 0;
        }
        return true;
    });
}
