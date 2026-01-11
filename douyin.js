/*
 * Douyin AdBlock Script for Loon
 * 
 * 功能：
 * 1. 去除信息流 (Feed) 中的广告 (is_ads, ad_info, raw_ad_data)
 * 2. 去除开屏 (Splash) 广告预加载
 * 3. 去除评论区 (Comment) 顶部推广
 * 4. 净化用户主页 (Profile) 推广入口
 * 5. (可选) 尝试替换无水印视频源
 * 
 * 配置建议：
 *
 * http-response ^https?:\/\/aweme\.snssdk\.com\/aweme\/v1\/(feed|splash|comment\/list|user\/profile\/other)\/ script-path=douyin.js, requires-body=true, timeout=30, tag=抖音去广告
 * 
 *
 * hostname = aweme.snssdk.com
 */

const url = $request.url;
const method = $request.method;
let body = $response.body;
let isModified = false;

// 只有 GET 请求且有 Body 时才处理
if (method === "GET" && body) {
    try {
        let obj = JSON.parse(body);

        // 路由分发：根据 URL 关键词调用不同的处理函数
        if (url.indexOf("/aweme/v1/feed/")!== -1) {
            processFeed(obj);
        } else if (url.indexOf("/aweme/v1/splash/")!== -1) {
            processSplash(obj);
        } else if (url.indexOf("/aweme/v1/comment/list/")!== -1) {
            processComments(obj);
        } else if (url.indexOf("/aweme/v1/user/profile/other/")!== -1) {
            processProfile(obj);
        }

        // 如果对象被修改了，重新序列化为字符串并返回
        if (isModified) {
            $done({ body: JSON.stringify(obj) });
        } else {
            $done({}); // 维持原样
        }

    } catch (e) {
        console.log("Douyin AdBlock Error: " + e);
        $done({}); // 出错时返回原数据，避免 App 崩溃
    }
} else {
    $done({});
}

/**
 * 处理信息流广告 (Feed)
 */
function processFeed(obj) {
    if (obj.aweme_list && Array.isArray(obj.aweme_list)) {
        const initialLength = obj.aweme_list.length;
        
        obj.aweme_list = obj.aweme_list.filter(item => {
            // 1. 显式广告标记
            if (item.is_ads === true) return false;
            
            // 2. 存在广告信息对象
            if (item.ad_info) return false;
            
            // 3. 存在原始广告数据 (通常是加密字符串)
            if (item.raw_ad_data) return false;
            
            // 4. 直播间推广 (aweme_type 101 通常为直播)
            // 可根据需要开启：如果不看直播推荐可取消注释
            // if (item.aweme_type === 101 &&!item.author.following_count) return false;

            // 5. 视频下方的购物/游戏推广标签 (不删视频，只删标签)
            if (item.promotions && item.promotions.length > 0) {
                delete item.promotions;
            }
            if (item.status && item.status.review_result) {
                delete item.status.review_result; // 有时包含审核推广信息
            }

            // 6. 尝试无水印处理
            handleWatermark(item);

            return true;
        });

        if (obj.aweme_list.length < initialLength) {
            isModified = true;
            console.log(` Feed cleaned: removed ${initialLength - obj.aweme_list.length} ads`);
        }
    }
}

/**
 * 处理开屏广告 (Splash)
 * 策略：清空数据，让 App 认为没有开屏配置
 */
function processSplash(obj) {
    if (obj.data) {
        // 清空 data 及其子项
        if (Array.isArray(obj.data)) {
            obj.data =;
        } else {
            obj.data = {};
        }
        
        // 强制设置状态码
        obj.status_code = 0;
        
        // 清理可能存在的预加载列表
        if (obj.splash_list) obj.splash_list =;
        
        isModified = true;
        console.log(" Splash config cleaned");
    }
}

/**
 * 处理评论区广告 (Comments)
 * 策略：移除置顶的推广评论或广告 Banner
 */
function processComments(obj) {
    if (obj.comments && Array.isArray(obj.comments)) {
        const initialLength = obj.comments.length;
        
        obj.comments = obj.comments.filter(comment => {
            // 1. 评论本身被标记为广告
            if (comment.is_ad === true) return false;
            
            // 2. 包含广告链接或组件
            if (comment.ad_info) return false;
            
            // 3. 这里的 1通常代表置顶的活动推广
            if (comment.item_type === 1) return false;

            return true;
        });

        if (obj.comments.length < initialLength) {
            isModified = true;
            console.log(" Comments cleaned");
        }
    }
    
    // 移除评论区顶部的 Banner 广告区
    if (obj.ad_info) {
        delete obj.ad_info;
        isModified = true;
    }
}

/**
 * 处理用户主页 (Profile)
 * 策略：移除“我的订单”、“我的钱包”等非内容项
 */
function processProfile(obj) {
    if (obj.user) {
        // 移除带货橱窗等入口
        if (obj.user.card_entries && Array.isArray(obj.user.card_entries)) {
            obj.user.card_entries = obj.user.card_entries.filter(entry => {
                // 过滤掉包含“购”、“买”、“推广”等关键词的入口
                const title = entry.title |

| "";
                if (title.includes("购") |

| title.includes("橱窗")) return false;
                return true;
            });
            isModified = true;
        }
        
        // 移除企业号/机构认证带来的营销组件
        if (obj.user.enterprise_verify_reason) {
            delete obj.user.enterprise_verify_reason;
            isModified = true;
        }
    }
}

/**
 * 辅助函数：处理水印 (Watermark)
 * 策略：尝试将 play_addr 替换为高码率无水印流
 */
function handleWatermark(item) {
    if (item.video) {
        let originLink = null;
        
        // 尝试从 play_addr_h264 获取 (有时包含无水印高码率)
        if (item.video.play_addr_h264 && item.video.play_addr_h264.url_list) {
            originLink = item.video.play_addr_h264.url_list;
        } 
        // 备选：从 720p/1080p 列表中寻找
        else if (item.video.bit_rate && Array.isArray(item.video.bit_rate)) {
            for (let rate of item.video.bit_rate) {
                if (rate.play_addr && rate.play_addr.url_list) {
                    originLink = rate.play_addr.url_list;
                    break; // 找到第一个可用源即可
                }
            }
        }
        
        // 替换主播放地址
        if (originLink && item.video.play_addr) {
            item.video.play_addr.url_list = originLink;
            item.video.download_addr.url_list = originLink; // 同时修改下载地址
            // 注意：不设置 isModified = true，因为修改过深，只做局部替换引用
            // 如果需要强制生效，请取消下面注释（会增加 CPU 开销）
            // isModified = true; 
        }
    }
}
