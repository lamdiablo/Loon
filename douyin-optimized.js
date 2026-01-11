/*
 * 抖音去广告深度优化脚本 (Douyin AdBlock Optimized)
 * Update: 2026-01-11
 * 
 * 核心功能：
 * 1. 强力移除团购/探店视频 (基于 Anchors 关键词和 POI 属性)
 * 2. 强力移除带货视频 (小黄车、橱窗、电商标签)
 * 3. 移除直播间带货卡片
 * 4. 移除评论区置顶推广
 */

const url = $request.url;
const method = $request.method;
const body = $response.body;

if (!body |

| method!== "GET") {
    $done({});
}

try {
    let obj = JSON.parse(body);
    let isModified = false;

    // --- 路由分发 ---
    
    // 1. 处理主信息流 (Feed / Nearby / Search)
    if (url.indexOf("/aweme/v1/feed/")!== -1 |

| 
        url.indexOf("/aweme/v1/nearby/feed/")!== -1 ||
        url.indexOf("/aweme/v1/search/item/")!== -1 ||
        url.indexOf("/aweme/v1/general/search/")!== -1) {
        
        let list = obj.aweme_list |

| obj.data; // 兼容搜索结果的 data 字段
        
        if (list && Array.isArray(list) && list.length > 0) {
            const initialLength = list.length;
            
            // 使用 filter 过滤掉不需要的视频
            let newList = list.filter(item => {
                return isCleanItem(item);
            });
            
            if (newList.length < initialLength) {
                isModified = true;
                console.log(`Douyin Clean: Removed ${initialLength - newList.length} items`);
            }
            
            // 写回对象
            if (obj.aweme_list) obj.aweme_list = newList;
            if (obj.data) obj.data = newList;
        }
    } 
    // 2. 处理评论区 (Comments)
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
    // 3. 处理用户主页 (Profile)
    else if (url.indexOf("/aweme/v1/user/profile/other/")!== -1) {
        if (obj.user) {
            // 移除企业认证信息（通常包含推广）
            if (obj.user.enterprise_verify_reason) delete obj.user.enterprise_verify_reason;
            // 移除带货入口
            if (obj.user.card_entries) obj.user.card_entries =;
            isModified = true;
        }
    }

    // --- 结束处理 ---
    if (isModified) {
        $done({ body: JSON.stringify(obj) });
    } else {
        $done({});
    }

} catch (e) {
    console.log("Douyin Script Error: " + e);
    $done({});
}

/**
 * 核心过滤逻辑：判断单个视频是否保留
 * 返回 true 保留，返回 false 移除
 */
function isCleanItem(item) {
    // === 1. 基础硬广过滤 ===
    if (item.is_ads === true) return false;
    if (item.raw_ad_data) return false;
    if (item.ad_info) return false;

    // === 2. 购物/电商/带货广告 (对应图2：小黄车) ===
    
    // 检查 simple_promotions (最常见的黄色购物车)
    if (item.simple_promotions && item.simple_promotions.length > 0) {
        return false; // 直接移除整个视频
    }
    
    // 检查 commerce_info (电商信息)
    if (item.commerce_info && item.commerce_info.head_image_url) {
        return false;
    }
    
    // 检查 aweme_type (61: 商品视频, 150: 某些类型的广告)
    if (item.aweme_type === 61 |

| item.aweme_type === 150) {
        return false;
    }

    // === 3. 直播间过滤 ===
    // 101: 直播中
    if (item.aweme_type === 101) {
        // 如果包含电商组件，移除
        if (item.room && item.room.has_commerce_goods) return false;
        // 如果包含促销信息，移除
        if (item.room && item.room.promotions && item.room.promotions.length > 0) return false;
        
        // 可选：如果不看任何直播，直接 return false
    }

    // === 4. 团购/本地生活/探店广告 (对应图1：底部Bar) ===
    
    // 检查 anchors (视频底部的横条)
    if (item.anchors && Array.isArray(item.anchors) && item.anchors.length > 0) {
        // 遍历所有锚点，只要发现商业化关键词，直接移除整个视频
        // 这样可以避免“视频还在，但链接没了”的尴尬情况
        for (let anchor of item.anchors) {
            const keyword = (anchor.keyword |

| "").toLowerCase();
            const schema = (anchor.schema |

| "").toLowerCase();
            const type = anchor.type;

            // 关键词黑名单
            if (keyword.includes("团购") |

| 
                keyword.includes("购买") |

| 
                keyword.includes("优惠") |

| 
                keyword.includes("特价") |

| 
                keyword.includes("下单") |

| 
                keyword.includes("充值")) {
                return false;
            }
            
            // 协议黑名单 (大众点评、美团、携程)
            if (schema.includes("dianping") |

| 
                schema.includes("meituan") |

| 
                schema.includes("ctrip")) {
                return false;
            }

            // 类型黑名单 (3: 购物, 1001: 团购/POI, 2000+: 游戏/应用下载)
            if (type === 3 |

| type === 1001 |
| (type >= 2000 && type <= 2999)) {
                return false;
            }
        }
    }

    // 检查 POI 信息 (地理位置)
    if (item.poi_info) {
        // 如果 POI 包含强烈的商业属性（外卖、代金券、团购），移除视频
        if (item.poi_info.is_waimai |

| item.poi_info.voucher_release_areas |
| item.poi_info.cost) {
            return false;
        }
        // 如果只是普通的地点打卡（如风景区），保留视频但移除 POI 标签，还你清爽界面
        // delete item.poi_info; 
    }

    return true; // 通过所有检查，保留视频
}
