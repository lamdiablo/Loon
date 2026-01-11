/*
 * 抖音去广告终极版 (Douyin Ultimate AdBlock)
 * 策略：零容忍。只要发现商业推广痕迹，直接移除整个视频/条目。
 * 覆盖：开屏、信息流硬广、团购探店、直播带货、商品橱窗、游戏发行人计划。
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

    // ==========================================
    // 场景 1: 主信息流 / 搜索 / 同城 (Feed, Search, Nearby)
    // ==========================================
    if (url.includes("/aweme/v1/feed/") |

| 
        url.includes("/aweme/v1/nearby/feed/") |

| 
        url.includes("/aweme/v1/search/item/") |

| 
        url.includes("/aweme/v1/general/search/")) {
        
        // 兼容不同的列表字段名 (search接口有时用data，feed用aweme_list)
        let list = obj.aweme_list |

| obj.data;
        
        if (list && Array.isArray(list) && list.length > 0) {
            const initialLength = list.length;
            
            // 使用 filter 强力过滤
            let newList = list.filter(item => {
                return isCleanItem(item);
            });
            
            if (newList.length!== initialLength) {
                isModified = true;
                console.log(` Blocked ${initialLength - newList.length} items.`);
            }
            
            // 归位
            if (obj.aweme_list) obj.aweme_list = newList;
            if (obj.data) obj.data = newList;
        }
    } 
    // ==========================================
    // 场景 2: 评论区 (Comment List)
    // ==========================================
    else if (url.includes("/aweme/v1/comment/list/")) {
        // 移除评论区顶部的 Banner 广告
        if (obj.ad_info) {
            delete obj.ad_info;
            isModified = true;
        }
        // 移除“相关搜索”气泡
        if (obj.guide_search_words) {
            delete obj.guide_search_words;
            isModified = true;
        }
        // 过滤置顶的推广评论 (item_type=1 通常是置顶)
        if (obj.comments && Array.isArray(obj.comments)) {
            const oldLen = obj.comments.length;
            obj.comments = obj.comments.filter(c => {
                return!c.is_ad && c.item_type!== 1 &&!c.ad_info;
            });
            if (obj.comments.length!== oldLen) isModified = true;
        }
    }
    // ==========================================
    // 场景 3: 用户主页 (User Profile)
    // ==========================================
    else if (url.includes("/aweme/v1/user/profile/other/")) {
        if (obj.user) {
            // 移除企业认证信息（蓝V认证通常都是营销号）
            if (obj.user.enterprise_verify_reason) delete obj.user.enterprise_verify_reason;
            // 移除“我的橱窗”、“下单”等入口
            if (obj.user.card_entries) obj.user.card_entries =;
            // 移除电商入口信息
            if (obj.user.commerce_info) delete obj.user.commerce_info;
            isModified = true;
        }
    }

    if (isModified) {
        $done({ body: JSON.stringify(obj) });
    } else {
        $done({});
    }

} catch (e) {
    console.log(" Error: " + e);
    $done({});
}

/**
 * 核心判断逻辑：判断单条视频是否应该保留
 * @param {Object} item 视频对象
 * @returns {Boolean} true=保留, false=移除
 */
function isCleanItem(item) {
    // 1. 【硬广】直接标记为广告的
    if (item.is_ads === true) return false;
    if (item.raw_ad_data) return false;
    if (item.ad_info) return false;

    // 2. 【电商带货】(对应图2 - 购物车/橱窗)
    // 只要包含 simple_promotions (黄色小黄车)，直接移除视频
    if (item.simple_promotions && item.simple_promotions.length > 0) return false;
    // 只要包含电商信息 (commerce_info)，移除
    if (item.commerce_info && item.commerce_info.head_image_url) return false;
    // 包含小程序引导 (micro_app_info)，通常是游戏或测试类广告
    if (item.micro_app_info) return false;

    // 3. 【团购/探店】(对应图1 - 底部链接)
    // 检查 anchors (锚点)，这是团购链接的主要藏身处
    if (item.anchors && Array.isArray(item.anchors) && item.anchors.length > 0) {
        for (let anchor of item.anchors) {
            // 商业锚点类型 ID 黑名单
            // 3: 购物车, 1001: 团购/POI, 2000-2999: 游戏/应用下载/推广
            const type = anchor.type;
            if (type === 3 |

| type === 1001 |
| (type >= 2000 && type <= 3000)) {
                return false;
            }
            
            // 关键词强力查杀 (针对漏网之鱼)
            const jsonStr = JSON.stringify(anchor).toLowerCase();
            if (jsonStr.includes("购买") |

| 
                jsonStr.includes("团购") |

| 
                jsonStr.includes("优惠") |

| 
                jsonStr.includes("推荐") |

| 
                jsonStr.includes("安装") |

| 
                jsonStr.includes("下载")) {
                return false;
            }
        }
    }

    // 4. 【POI 地理位置营销】
    // 很多探店视频通过 POI 挂载团购券
    if (item.poi_info) {
        // 如果包含 "cost"(人均消费), "voucher"(代金券), "is_waimai"(外卖)，视为营销视频，移除
        if (item.poi_info.cost |

| item.poi_info.voucher_release_areas |
| item.poi_info.is_waimai) {
            return false;
        }
        // 仅保留纯粹的风景打卡，移除普通 POI 标签防止干扰
        delete item.poi_info;
    }

    // 5. 【直播推广】
    if (item.aweme_type === 101) {
        // 检查直播间是否挂载商品
        if (item.room && item.room.has_commerce_goods) return false;
        if (item.room && item.room.promotions && item.room.promotions.length > 0) return false;
        // 过滤“游戏推广”类直播
        if (item.game_info) return false;
    }

    // 6. 【游戏发行人计划】
    if (item.video_game_data_channel) return false;

    return true;
}
