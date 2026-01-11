/*
 * Telegram Web Ad Cleaner v2.0
 * 适配 Loon/Surge/Quantumult X
 * 功能：通过 MITM 向网页注入 MutationObserver 逻辑，实时移除赞助消息 DOM 元素
 */

const body = $response.body;

// 注入到网页中的核心清理逻辑
// 这段代码会在浏览器端执行
const injectCode = `
<script>
(function() {
    'use strict';
    
    console.log('Loon TG AdBlock: Initializing...');

    // 配置：需要屏蔽的CSS选择器列表
    // Telegram Web 经常更新混淆类名，使用属性选择器或结构选择器更稳定
    const adSelectors =',      // 模糊匹配类名
        'div:has(>.sponsored-label)',   // 包含“Sponsored”标签的容器
        'div[data-peer-id="-1"]',       // 部分系统推广消息ID（需谨慎测试）
        '.chat-input-control + div',    // 某些版本中位于输入框上方的横幅
        'div:has(>.bubble-content >.service-msg)' // 部分服务推广气泡
    ];

    function log(msg) {
        console.log(' ' + msg);
    }

    function removeAds() {
        let removedCount = 0;
        adSelectors.forEach(selector => {
            try {
                // 尝试查找广告元素
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    // 如果元素存在且未被隐藏
                    if (el && el.style.display!== 'none') {
                        // 再次确认内容特征，防止误伤（可选）
                        if(el.innerText && (el.innerText.includes('Sponsored') |

| el.innerText.includes('ad'))) {
                             el.style.display = 'none';
                             el.setAttribute('data-loon-removed', 'true'); // 标记已处理
                             removedCount++;
                        } else if (selector.includes('peer-id')) {
                             // 对于ID匹配的，直接隐藏
                             el.style.display = 'none';
                             removedCount++;
                        }
                    }
                });
            } catch (e) {
                // 忽略无效选择器错误（如不支持 :has 伪类的旧浏览器）
            }
        });
        
        if (removedCount > 0) {
            log('Removed ' + removedCount + ' ad elements.');
        }
    }

    // 1. 页面加载后立即执行一次清理
    window.addEventListener('load', removeAds);
    removeAds(); // 立即尝试

    // 2. 设置 MutationObserver 监听动态加载的消息
    // Telegram Web 是单页应用(SPA)，消息是动态插入的
    const observer = new MutationObserver((mutations) => {
        let shouldCheck = false;
        for(let mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                shouldCheck = true;
                break;
            }
        }
        if (shouldCheck) {
            removeAds();
        }
    });

    // 开始监听 body 的子节点变化
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    log('Observer started.');
})();
</script>
`;

// 脚本主逻辑：将上面的代码注入到 HTML 的 <head> 或 <body> 中
if ($response.headers && ($response.headers['content-type'] |

| $response.headers).indexOf('text/html')!== -1) {
    // 寻找 </head> 标签并在其之前插入脚本
    if (body.indexOf('</head>')!== -1) {
        const newBody = body.replace('</head>', injectCode + '</head>');
        $done({ body: newBody });
    } else {
        // 如果没有 head 标签，尝试插入到 body
        const newBody = body + injectCode;
        $done({ body: newBody });
    }
} else {
    // 非 HTML 请求直接放行
    $done({});
}
