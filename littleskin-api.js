
// LittleSkin皮肤站API支持
const https = require('https');
const fs = require('fs');
const path = require('path');

class LittleSkinAPI {
    constructor() {
        this.baseURL = 'https://littleskin.cn/api';
        this.yggdrasilURL = 'https://littleskin.cn/api/yggdrasil';
    }

    // 获取用户皮肤信息
    async getUserSkin(username) {
        try {
            console.log(`🌟 正在从LittleSkin获取用户 "${username}" 的皮肤信息...`);
            
            const profileData = await this.makeRequest(`${this.yggdrasilURL}/sessionserver/session/minecraft/profile/${username}`);
            
            if (profileData && profileData.properties) {
                const texturesProperty = profileData.properties.find(prop => prop.name === 'textures');
                if (texturesProperty) {
                    const texturesData = JSON.parse(Buffer.from(texturesProperty.value, 'base64').toString());
                    return {
                        success: true,
                        skinUrl: texturesData.textures?.SKIN?.url,
                        capeUrl: texturesData.textures?.CAPE?.url,
                        username: profileData.name,
                        uuid: profileData.id
                    };
                }
            }
            
            return { success: false, message: '未找到皮肤信息' };
        } catch (error) {
            // 完全屏蔽404错误，因为这不影响皮肤功能
            if (error.message.includes('HTTP 404')) {
                // 完全静默处理404，不打印任何日志
                return { success: false, message: '皮肤API 404', silent: true };
            }
            console.error('LittleSkin API错误:', error.message);
            return { success: false, message: error.message };
        }
    }

    // Yggdrasil认证
    async authenticate(username, password) {
        try {
            console.log(`🔐 正在使用LittleSkin Yggdrasil认证用户: ${username}`);
            
            const authData = {
                agent: {
                    name: "Minecraft",
                    version: 1
                },
                username: username,
                password: password,
                clientToken: this.generateClientToken()
            };

            const response = await this.makeRequest(`${this.yggdrasilURL}/authserver/authenticate`, 'POST', authData);
            
            if (response && response.accessToken) {
                console.log('✅ LittleSkin认证成功！');
                return {
                    success: true,
                    accessToken: response.accessToken,
                    clientToken: response.clientToken,
                    selectedProfile: response.selectedProfile,
                    user: response.user
                };
            }
            
            return { success: false, message: '认证失败' };
        } catch (error) {
            console.error('LittleSkin认证错误:', error.message);
            return { success: false, message: error.message };
        }
    }

    // 验证访问令牌
    async validate(accessToken, clientToken) {
        try {
            const validateData = {
                accessToken: accessToken,
                clientToken: clientToken
            };

            await this.makeRequest(`${this.yggdrasilURL}/authserver/validate`, 'POST', validateData);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    // 刷新访问令牌
    async refresh(accessToken, clientToken) {
        try {
            const refreshData = {
                accessToken: accessToken,
                clientToken: clientToken
            };

            const response = await this.makeRequest(`${this.yggdrasilURL}/authserver/refresh`, 'POST', refreshData);
            return {
                success: true,
                accessToken: response.accessToken,
                clientToken: response.clientToken
            };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    // 生成客户端令牌
    generateClientToken() {
        return 'aterbot-' + Math.random().toString(36).substring(2, 15);
    }

    // 发起HTTP请求
    makeRequest(url, method = 'GET', data = null) {
        return new Promise((resolve, reject) => {
            const options = {
                method: method,
                headers: {
                    'User-Agent': 'AterBot/1.0',
                    'Content-Type': 'application/json'
                }
            };

            if (data && method !== 'GET') {
                const postData = JSON.stringify(data);
                options.headers['Content-Length'] = Buffer.byteLength(postData);
            }

            const req = https.request(url, options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            const parsed = responseData ? JSON.parse(responseData) : {};
                            resolve(parsed);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                        }
                    } catch (error) {
                        reject(new Error(`解析响应失败: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`请求失败: ${error.message}`));
            });

            if (data && method !== 'GET') {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    // 保存认证信息到文件
    saveAuthData(authData, username) {
        try {
            const authDir = './littleskin_profiles';
            if (!fs.existsSync(authDir)) {
                fs.mkdirSync(authDir);
            }

            const authFile = path.join(authDir, `${username}.json`);
            fs.writeFileSync(authFile, JSON.stringify(authData, null, 2));
            console.log(`💾 LittleSkin认证信息已保存: ${authFile}`);
        } catch (error) {
            console.error('保存认证信息失败:', error);
        }
    }

    // 加载认证信息
    loadAuthData(username) {
        try {
            const authFile = path.join('./littleskin_profiles', `${username}.json`);
            if (fs.existsSync(authFile)) {
                const authData = JSON.parse(fs.readFileSync(authFile, 'utf8'));
                console.log(`📁 加载LittleSkin认证信息: ${username}`);
                return authData;
            }
        } catch (error) {
            console.error('加载认证信息失败:', error);
        }
        return null;
    }
}

module.exports = LittleSkinAPI;
