/*
 * 抖音去广告深度优化脚本 (Douyin AdBlock Optimized)
 * 适配平台: Loon
 * 
 * 主要功能：
 * 1. 移除信息流 (Feed) 中的硬广 (is_ads)
 * 2. 移除购物袋/商品卡片 (simple_promotions)
 * 3. 移除团购锚点与商业化POI (anchors, poi_info)
 * 4. 移除直播间带货卡片
 * 
 * 最后更新: 2026-01-11
 */

const url = $request.url;
const method = $request.method;
const body = $response.body;

if (!body |

| method!== "GET") {
    $done({});
}

let obj = null;
try {
    obj = JSON.parse(body);
} catch (e) {
    console.log("JSON Parse Error: " + e);
    $done({});
}

if (obj) {
    try {
        let isModified = false;

        // --- 1. 处理主信息流 (Feed / Nearby / Search) ---
        if (url.indexOf("/aweme/v1/feed/")!== -1 |

| 
            url.indexOf("/aweme/v1/nearby/feed/")!== -1 ||
            url.indexOf("/aweme/v1/search/item/")!== -1 ||
            url.indexOf("/aweme/v1/general/search/")!== -1) {
            
            let list = obj.aweme_list |

| obj.data; // 兼容搜索结果的 data 字段
            if (list && Array.isArray(list) && list.length > 0) {
                const initialLength = list.length;
                
                obj.aweme_list = list.filter(item => {
                    return isCleanItem(item);
                });
                
                // 如果是搜索接口，还原回 data
                if (obj.data) obj.data = obj.aweme_list;
                
                if (obj.aweme_list.length < initialLength) isModified = true;
            }
        } 
        // --- 2. 处理评论区 (Comments) ---
        else if (url.indexOf("/aweme/v1/comment/list/")!== -1) {
            if (obj.ad_info) {
                delete obj.ad_info;
                isModified = true;
            }
            if (obj.comments && Array.isArray(obj.comments)) {
                obj.comments = obj.comments.filter(c =>!c.is_ad && c.item_type!== 1);
                isModified = true;
            }
        }

        if (isModified) {
            $done({ body: JSON.stringify(obj) });
        } else {
            $done({});
        }

    } catch (e) {
        console.log("Script Error: " + e);
        $done({});
    }
} else {
    $done({});
}

// --- 核心过滤逻辑 ---
function isCleanItem(item) {
    // 1. 硬广过滤
    if (item.is_ads === true) return false;
    if (item.raw_ad_data) return false;
    if (item.ad_info) return false;

    // 2. 购物/电商广告 (黄色小黄车/商品卡片)
    // 识别 simple_promotions 字段
    if (item.simple_promotions && item.simple_promotions.length > 0) {
        // 如果你不希望看到任何带货视频，返回 false 删除视频
        // 如果希望保留视频但移除购物车，使用 delete item.simple_promotions 并返回 true
        return false; 
    }
    // 识别电商信息 commerce_info
    if (item.commerce_info && item.commerce_info.head_image_url) {
        return false;
    }

    // 3. 直播间带货过滤
    if (item.aweme_type === 101) { 
        if (item.room && item.room.has_commerce_goods) return false;
        if (item.room && item.room.promotions && item.room.promotions.length > 0) return false;
    }

    // 4. 团购/本地生活广告
    // 团购通常挂载在 anchors (锚点) 或 poi_info (定位) 中
    
    // 清洗 Anchors (视频底部的横条)
    if (item.anchors && Array.isArray(item.anchors)) {
        // 过滤掉特定类型的锚点
        item.anchors = item.anchors.filter(anchor => {
            // 关键词匹配：包含这些词的锚点一律移除
            const keyword = anchor.keyword |

| "";
            const schema = anchor.schema |

| "";
            
            if (keyword.includes("团购") |

| 
                keyword.includes("购买") |

| 
                keyword.includes("充值") ||
                schema.includes("dianping") |

| // 大众点评
                schema.includes("meituan")) {  // 美团
                return false;
            }
            // 类型 ID 匹配 (1001=团购, 3=购物)
            if (anchor.type === 1001 |

| anchor.type === 3) return false;
            
            return true;
        });
        
        if (item.anchors.length === 0) delete item.anchors;
    }

    // 清洗 POI (地理位置信息)
    // 策略：如果是纯景点打卡保留，如果是团购卖券则移除 POI 字段
    if (item.poi_info) {
        // 检查是否包含交易/团购特征
        if (item.poi_info.is_waimai |

| // 外卖
            item.poi_info.voucher_release_areas |

| // 代金券
            item.poi_info.cost |

| // 人均消费
            item.poi_info.sp_source) { // 推广来源
            
            delete item.poi_info; // 移除 POI 信息，但保留视频
        }
    }

    return true;
}
