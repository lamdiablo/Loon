/*
 * Pinterest AdBlock Script for Loon / Surge / Quantumult X
 * 功能：移除 Pinterest 瀑布流、搜索结果及详情页中的广告与推广内容
 * 适用接口：v3, v4, v5 (Home Feed, Search, Related Pins)
 */

/**
 * 判断单个对象是否为广告或干扰内容
 * @param {Object} item - Pin 对象
 * @returns {Boolean} - True 表示是广告，需移除
 */
function isAd(item) {
    if (!item) return false;

    // 1. 核心特征：is_promoted (布尔值或字符串形式)
    if (item.is_promoted === true |

| item.is_promoted === "true") {
        return true;
    }

    // 2. 核心特征：promoted_by (存在该对象即为推广)
    if (item.promoted_by) {
        return true;
    }

    // 3. 辅助特征：attribution (包含赞助商信息)
    if (item.attribution && (item.attribution.type === "promoted" |

| item.attribution.is_sponsored)) {
        return true;
    }

    // 4. 类型过滤：移除“为您推荐的搜索”、“购物清单”等干扰模块
    const blockTypes = [
        "search_query_suggestion", 
        "board_recommendation", 
        "shop_the_look", 
        "promoted_pin",
        "shopping_recommendation",
        "story_ad"
    ];
    
    if (blockTypes.includes(item.type) |

| blockTypes.includes(item.card_type)) {
        return true;
    }

    // 5. 针对“Shoppable Pins”的过滤 (商品标记)
    if (item.buyable_product) {
        return true;
    }

    return false;
}

// 主处理逻辑
let body = $response.body;

if (body) {
    try {
        let json = JSON.parse(body);
        let modified = false;

        // 情况 A: 根数据即为数组 (部分旧版 API 或简单列表)
        if (Array.isArray(json)) {
            const originalLength = json.length;
            json = json.filter(item =>!isAd(item));
            if (json.length!== originalLength) modified = true;
        }
        
        // 情况 B: 标准结构，数据在 json.data 中
        if (json.data) {
            if (Array.isArray(json.data)) {
                // data 是数组 (如首页流)
                const originalLength = json.data.length;
                json.data = json.data.filter(item =>!isAd(item));
                if (json.data.length!== originalLength) modified = true;

            } else if (typeof json.data === 'object') {
                // data 是对象 (如搜索结果或详情页)
                
                // 处理 items 数组
                if (json.data.items && Array.isArray(json.data.items)) {
                    const originalLength = json.data.items.length;
                    json.data.items = json.data.items.filter(item =>!isAd(item));
                    if (json.data.items.length!== originalLength) modified = true;
                }
                
                // 处理 pins 数组
                if (json.data.pins && Array.isArray(json.data.pins)) {
                    const originalLength = json.data.pins.length;
                    json.data.pins = json.data.pins.filter(item =>!isAd(item));
                    if (json.data.pins.length!== originalLength) modified = true;
                }
                
                // 处理 results 数组 (常见于搜索接口)
                if (json.data.results && Array.isArray(json.data.results)) {
                    const originalLength = json.data.results.length;
                    json.data.results = json.data.results.filter(item =>!isAd(item));
                    if (json.data.results.length!== originalLength) modified = true;
                }
            }
        }

        if (modified) {
            // console.log("Pinterest 净化生效，已移除广告内容");
            $done({ body: JSON.stringify(json) });
        } else {
            // 无需修改，直接返回
            $done({});
        }

    } catch (e) {
        console.log("Pinterest AdBlock Error: " + e);
        // 出错时原样返回，保证 App 不会白屏
        $done({});
    }
} else {
    $done({});
}
