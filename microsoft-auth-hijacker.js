
// Microsoft认证劫持器 - 将Microsoft OAuth流程重定向到第三方皮肤站
const { EventEmitter } = require('events');

class MicrosoftAuthHijacker extends EventEmitter {
    constructor(yggdrasilServerUrl) {
        super();
        this.yggdrasilServerUrl = yggdrasilServerUrl;
        this.originalFetch = global.fetch;
        this.isHijacked = false;
    }

    // 劫持Microsoft认证流程
    hijackMicrosoftAuth() {
        if (this.isHijacked) return;
        
        console.log('🎯 正在劫持Microsoft认证流程...');
        
        // 劫持fetch函数
        const self = this;
        global.fetch = function(url, options = {}) {
            // 检查是否是Microsoft认证相关的请求
            if (typeof url === 'string') {
                // Microsoft OAuth endpoints
                if (url.includes('login.microsoftonline.com') || 
                    url.includes('login.live.com') ||
                    url.includes('oauth.microsoft.com') ||
                    url.includes('api.minecraftservices.com') ||
                    url.includes('sessionserver.mojang.com')) {
                    
                    console.log(`🔄 劫持Microsoft请求: ${url}`);
                    
                    // 重定向到我们的皮肤站
                    return self.handleHijackedRequest(url, options);
                }
            }
            
            // 其他请求正常处理
            return self.originalFetch.call(this, url, options);
        };
        
        // 劫持XMLHttpRequest
        const originalXHROpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            if (typeof url === 'string' && (
                url.includes('login.microsoftonline.com') || 
                url.includes('login.live.com') ||
                url.includes('oauth.microsoft.com') ||
                url.includes('api.minecraftservices.com') ||
                url.includes('sessionserver.mojang.com'))) {
                
                console.log(`🔄 劫持XHR请求: ${url}`);
                // 重定向到皮肤站
                const newUrl = self.convertToYggdrasilUrl(url);
                return originalXHROpen.call(this, method, newUrl, ...args);
            }
            
            return originalXHROpen.call(this, method, url, ...args);
        };
        
        this.isHijacked = true;
        console.log('✅ Microsoft认证劫持已激活');
    }

    // 处理被劫持的请求
    async handleHijackedRequest(originalUrl, options) {
        console.log(`🎯 处理劫持的请求: ${originalUrl}`);
        
        try {
            // 模拟Microsoft OAuth成功响应
            if (originalUrl.includes('oauth') || originalUrl.includes('login')) {
                return new Response(JSON.stringify({
                    access_token: 'fake_microsoft_token_' + Date.now(),
                    token_type: 'Bearer',
                    expires_in: 3600,
                    scope: 'XboxLive.signin offline_access',
                    refresh_token: 'fake_refresh_token_' + Date.now()
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            // 模拟Minecraft服务响应
            if (originalUrl.includes('minecraftservices') || originalUrl.includes('mojang')) {
                return new Response(JSON.stringify({
                    username: this.gameUsername || 'YggdrasilUser',
                    roles: [],
                    access_token: 'fake_minecraft_token_' + Date.now()
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            // 其他情况，尝试转换到皮肤站URL
            const yggdrasilUrl = this.convertToYggdrasilUrl(originalUrl);
            console.log(`🔄 转换URL: ${originalUrl} -> ${yggdrasilUrl}`);
            
            return this.originalFetch(yggdrasilUrl, options);
            
        } catch (error) {
            console.log(`❌ 劫持请求处理失败: ${error.message}`);
            
            // 返回一个假的成功响应避免崩溃
            return new Response(JSON.stringify({
                success: true,
                message: 'Hijacked response'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    // 将Microsoft URL转换为Yggdrasil URL
    convertToYggdrasilUrl(microsoftUrl) {
        const baseUrl = this.yggdrasilServerUrl.replace('/api/yggdrasil', '');
        
        // OAuth认证
        if (microsoftUrl.includes('oauth') || microsoftUrl.includes('login')) {
            return `${baseUrl}/api/yggdrasil/authserver/authenticate`;
        }
        
        // Session服务
        if (microsoftUrl.includes('sessionserver')) {
            return `${baseUrl}/api/yggdrasil/sessionserver/session/minecraft/profile`;
        }
        
        // 默认返回认证服务器
        return `${baseUrl}/api/yggdrasil/authserver`;
    }

    // 设置游戏用户名
    setGameUsername(username) {
        this.gameUsername = username;
        console.log(`🎮 设置劫持游戏用户名: ${username}`);
    }

    // 恢复原始认证流程
    restoreOriginalAuth() {
        if (!this.isHijacked) return;
        
        console.log('🔄 恢复原始Microsoft认证流程');
        global.fetch = this.originalFetch;
        this.isHijacked = false;
        console.log('✅ 原始认证流程已恢复');
    }

    // 模拟Microsoft认证成功
    simulateMicrosoftAuthSuccess(username, email) {
        console.log(`🎭 模拟Microsoft认证成功: ${username} (${email})`);
        
        return {
            accessToken: 'hijacked_ms_token_' + Date.now(),
            clientToken: 'hijacked_client_token_' + Date.now(),
            selectedProfile: {
                id: this.generateUUID(),
                name: username
            },
            user: {
                id: this.generateUUID(),
                email: email,
                username: username
            },
            hijacked: true,
            originalProvider: 'microsoft',
            actualProvider: 'yggdrasil',
            serverUrl: this.yggdrasilServerUrl
        };
    }

    // 生成假UUID
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

module.exports = MicrosoftAuthHijacker;
