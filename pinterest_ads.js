/*
 * Pinterest AdBlock Script v3.2 (Ultimate Combined)
 * 集成功能：移除 Promoted 硬广、Stela 购物模块、商品推荐卡片、相关用户推荐
 * 兼容接口：v3 API (Feeds, Search, Related, Shopping, Visual Search)
 */

function isAd(item) {
    // 安全检查
    if (!item) return false;

    // ==========================================
    // 1. [硬广拦截] 明确标记为广告的内容
    // ==========================================
    if (item.is_promoted === true |

| item.is_promoted === "true") return true;
    if (item.promoted_by) return true;
    if (item.attribution && (item.attribution.type === "promoted" |

| item.attribution.is_sponsored)) return true;
    if (item.is_shopping_ad === true) return true;

    // ==========================================
    // 2. [模块拦截] 针对横向滚动的特定容器
    // ==========================================
    // "stela_shop" 是"购买此 Pin 图中的商品"模块的核心标识 (v3.1新增)
    if (item.story_type === "stela_shop" |

| item.story_type === "related_modules_header") {
        return true;
    }
    
    // 移除特定类型的 Module (干扰浏览的推荐模块)
    const blockModuleTypes = [
        "shopping_recommendation", // 购物推荐
        "product_group",           // 商品组
        "commerce_recommendation", // 电商推荐
        "shop_the_look",           // 购买同款
        "search_query_suggestion", // 搜索建议
        "user_recommendation",     // 用户推荐 (v3.2新增)
        "people_recommendation",   // 类似用户推荐
        "board_recommendation"     // 看板推荐
    ];
    
    if (item.module_type && blockModuleTypes.some(t => item.module_type.includes(t))) {
        return true;
    }

    // ==========================================
    // 3. [商品拦截] 伪装成普通图片的商品 (隐性广告)
    // ==========================================
    // 特征A: shopping_flags 数组不为空 (例如 [1, 2, 3, 4])
    if (item.shopping_flags && item.shopping_flags.length > 0) {
        return true;
    }

    // 特征B: 包含价格信息 (Rich Summary / Offer Price)
    if (item.rich_summary && item.rich_summary.products && item.rich_summary.products.length > 0) {
        return true;
    }
    // 兼容旧版API的价格字段 (v3.0回归)
    if (item.price_value |

| item.offer_price) {
        return true;
    }
    
    // 特征C: 辅助字段
    if (item.buyable_product) return true;

    // ==========================================
    // 4. [类型拦截] 特殊的对象类型
    // ==========================================
    if (item.type === "shop_the_look" |

| item.type === "promoted_pin" |
| item.type === "story_ad") {
        return true;
    }

    return false;
}

// 递归处理函数：能够深入 JSON 的每一层寻找并删除广告
function processData(obj) {
    if (Array.isArray(obj)) {
        // 如果是数组，过滤掉是广告的项，并对剩下的项递归处理
        return obj.filter(item =>!isAd(item)).map(processData);
    } else if (typeof obj === 'object' && obj!== null) {
        // 如果是对象，遍历所有属性
        for (let key in obj) {
            // 如果属性值是数组（例如 data: [...] 或 items: [...]），则进行过滤
            if (Array.isArray(obj[key])) {
                obj[key] = obj[key].filter(item =>!isAd(item)).map(processData);
            } else if (typeof obj[key] === 'object') {
                // 如果属性是对象，继续递归
                processData(obj[key]);
            }
        }
    }
    return obj;
}

// 脚本入口
let body = $response.body;
if (body) {
    try {
        let json = JSON.parse(body);
        
        // 针对 v3 接口常见的 response 结构进行处理
        if (json.resource_response) {
            processData(json.resource_response);
        } else {
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
