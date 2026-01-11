/*
 * Pinterest AdBlock Script Optimized
 * 针对性移除：瀑布流广告、搜索广告、以及“购买此Pin图中的商品”等购物模块
 */

function isAd(item) {
    if (!item) return false;

    // --- 1. 基础广告特征 ---
    if (item.is_promoted === true |

| item.is_promoted === "true") return true;
    if (item.promoted_by) return true;
    if (item.attribution && (item.attribution.type === "promoted" |

| item.attribution.is_sponsored)) return true;

    // --- 2. 针对截图位置的优化 (购物/商品模块) ---
    // 拦截特定模块类型 (Module Types)
    const shopModuleTypes = [
        "shop_the_look",           // 截图中的"购买此Pin中的商品"通常属此类
        "shopping_recommendation", // 购物推荐
        "commerce_recommendation", // 电商推荐
        "product_group",           // 商品组
        "search_query_suggestion", // 搜索建议
        "board_recommendation",    // 看板推荐
        "people_recommendation",   // 用户推荐
        "promoted_pin"
    ];

    if (item.module_type && shopModuleTypes.some(t => item.module_type.includes(t))) {
        return true;
    }
    
    // 拦截具体的对象类型 (Object Types)
    if (item.type === "shop_the_look" |

| item.type === "story_ad") {
        return true;
    }

    // --- 3. 针对“商品卡片”的强力拦截 ---
    // 只要包含价格信息或购买链接，视为购物广告移除
    if (item.price_value |

| item.offer_price |
| item.buyable_product) {
        return true;
    }
    
    // 检查辅助数据中的价格 (Metadata)
    if (item.pin_data && item.pin_data.videos && item.pin_data.videos.video_list) {
         // 部分视频广告
         return true; 
    }

    return false;
}

// 递归处理函数，用于应对不同层级的嵌套
function processData(obj) {
    if (Array.isArray(obj)) {
        // 核心过滤逻辑：如果 filter 返回 false，则移除该项
        return obj.filter(item =>!isAd(item)).map(processData);
    } else if (typeof obj === 'object' && obj!== null) {
        // 遍历对象属性，寻找可能包含数组的字段 (如 data, items, pins)
        for (let key in obj) {
            if (Array.isArray(obj[key])) {
                const originalLen = obj[key].length;
                obj[key] = obj[key].filter(item =>!isAd(item)).map(processData);
                // 可选：打印日志调试
                // if (obj[key].length!== originalLen) console.log(`[Pinterest] Removed ${originalLen - obj[key].length} ads from ${key}`);
            } else if (typeof obj[key] === 'object') {
                processData(obj[key]);
            }
        }
    }
    return obj;
}

let body = $response.body;
if (body) {
    try {
        let json = JSON.parse(body);
        
        // 开始处理整个 JSON 树
        if (json.resource_response) {
            // 针对 v3/resource 接口的特殊结构
            processData(json.resource_response);
        } else {
            // 通用结构
            processData(json);
        }

        $done({ body: JSON.stringify(json) });
    } catch (e) {
        console.log("Pinterest AdBlock Error: " + e);
        $done({});
    }
} else {
    $done({});
}
