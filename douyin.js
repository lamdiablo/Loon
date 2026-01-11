/*
 * 抖音去广告深度优化脚本 (Douyin AdBlock Optimized)
 * 
 * 核心功能：
 * 1. 移除信息流 (Feed) 中的硬广 (is_ads)
 * 2. 移除视频左下角的购物袋/商品卡片 (simple_promotions, commerce_info)
 * 3. 移除/净化团购锚点与POI定位 (anchors, poi_info)
 * 4. 移除直播间带货卡片
 * 5. 移除评论区置顶推广
 * 
 * 使用建议：配合 Loon/Surge/QX 的 MITM 功能使用
 */

const url = $request.url;
const method = $request.method;
let body = $response.body;

// 预处理：只处理 GET 请求且 Body 不为空的情况
if (method === "GET" && body) {
    try {
        let obj = JSON.parse(body);

        // --- 路由分发 ---
        if (url.indexOf("/aweme/v1/feed/")!== -1 |

| url.indexOf("/aweme/v1/nearby/feed/")!== -1) {
            // 处理推荐流和同城流
            if (obj.aweme_list && Array.isArray(obj.aweme_list)) {
                obj.aweme_list = processFeed(obj.aweme_list);
            }
        } 
        else if (url.indexOf("/aweme/v1/search/item/")!== -1 |

| url.indexOf("/aweme/v1/general/search/")!== -1) {
            // 处理搜索结果
            if (obj.data && Array.isArray(obj.data)) {
                obj.data = processFeed(obj.data);
            }
        } 
        else if (url.indexOf("/aweme/v1/comment/list/")!== -1) {
            // 处理评论区
            processComments(obj);
        }

        // --- 结束处理 ---
        $done({ body: JSON.stringify(obj) });

    } catch (e) {
        console.log(" Error: " + e.message);
        // 出错时返回原数据，防止白屏
        $done({});
    }
} else {
    $done({});
}

/**
 * 视频流核心处理函数
 * 针对：广告、团购、购物、直播带货
 */
function processFeed(list) {
    return list.filter(item => {
        // === 1. 硬广过滤 ===
        if (item.is_ads === true) return false;
        if (item.raw_ad_data |

| item.ad_info) return false;

        // === 2. 购物/电商广告 (Image 2 对应场景) ===
        // 过滤视频左下角挂载的“黄色购物车”或商品标签
        if (item.simple_promotions && item.simple_promotions.length > 0) {
            // 策略：直接移除带货视频（如果你不想看任何带货内容）
            return false; 
        }
        // 过滤电商推广视频
        if (item.commerce_info && item.commerce_info.head_image_url) {
            return false;
        }

        // === 3. 直播间带货过滤 ===
        if (item.aweme_type === 101) { 
            // 如果直播间包含商品推广，则移除
            if (item.room && item.room.has_commerce_goods) return false;
            if (item.room && item.room.promotions && item.room.promotions.length > 0) return false;
        }

        // === 4. 团购/本地生活广告 (Image 1 对应场景) ===
        // 策略：团购通常通过 anchors (锚点) 或 poi_info (定位) 展示
        
        // 清洗锚点 (Anchors) - 视频底部的横条
        if (item.anchors && Array.isArray(item.anchors)) {
            const originalAnchorCount = item.anchors.length;
            item.anchors = item.anchors.filter(anchor => {
                // 关键词黑名单：匹配到这些词的锚点都会被移除
                const blockKeywords = ["团购", "购买", "充值", "游戏", "下载", "详情", "领取"];
                
                if (anchor.keyword) {
                    if (blockKeywords.some(k => anchor.keyword.includes(k))) return false;
                }
                
                // 类型黑名单 (根据经验总结的商业化锚点Type)
                // 3: 购物, 1001: 团购, 2000+: 游戏/应用下载
                const blockTypes = ; 
                if (blockTypes.includes(anchor.type)) return false;

                // 检查 Schema 协议
                if (anchor.schema && (anchor.schema.includes("dianping") |

| anchor.schema.includes("meituan"))) {
                    return false;
                }

                return true;
            });

            // 如果清洗后没有锚点，删除该字段，界面更清爽
            if (item.anchors.length === 0) delete item.anchors;
        }

        // 清洗 POI 信息 (Poi Info) - 视频左下角的定位
        if (item.poi_info) {
            // 如果 POI 包含团购券、外卖信息，则删除 POI 字段
            // 注意：这里只删除定位信息，保留视频内容。
            // 如果你想连视频一起删，可以将下面的 delete 改为 return false
            if (item.poi_info.is_waimai |

| item.poi_info.voucher_release_areas |
| item.poi_info.cost) {
                delete item.poi_info;
            }
        }

        return true; // 保留该视频
    });
}

/**
 * 评论区处理函数
 */
function processComments(obj) {
    // 移除评论区顶部的 Banner 广告
    if (obj.ad_info) delete obj.ad_info;

    // 移除评论列表中的推广/置顶评论
    if (obj.comments && Array.isArray(obj.comments)) {
        obj.comments = obj.comments.filter(comment => {
            if (comment.is_ad === true) return false;
            if (comment.item_type === 1) return false; // 通常是置顶推广
            return true;
        });
    }
}
