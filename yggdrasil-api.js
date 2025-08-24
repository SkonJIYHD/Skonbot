
// 通用Yggdrasil皮肤站API支持
const https = require('https');
const fs = require('fs');
const path = require('path');

class YggdrasilAPI {
    constructor(baseURL) {
        // 确保baseURL以/结尾
        this.baseURL = baseURL.endsWith('/') ? baseURL : baseURL + '/';
        this.authServerURL = this.baseURL + 'authserver';
        this.sessionServerURL = this.baseURL + 'sessionserver';
    }

    // 获取用户皮肤信息
    async getUserSkin(username) {
        try {
            console.log(`🌟 正在从Yggdrasil皮肤站获取用户 "${username}" 的皮肤信息...`);
            
            // 先通过名称查询获取UUID
            const profilesData = await this.makeRequest(`${this.baseURL}api/profiles/minecraft`, 'POST', [username]);
            
            if (!profilesData || profilesData.length === 0) {
                return { success: false, message: '未找到用户' };
            }

            const profile = profilesData[0];
            const uuid = profile.id;

            // 通过UUID获取完整的皮肤信息
            const fullProfile = await this.makeRequest(`${this.sessionServerURL}/session/minecraft/profile/${uuid}`);
            
            if (fullProfile && fullProfile.properties) {
                const texturesProperty = fullProfile.properties.find(prop => prop.name === 'textures');
                if (texturesProperty) {
                    const texturesData = JSON.parse(Buffer.from(texturesProperty.value, 'base64').toString());
                    return {
                        success: true,
                        skinUrl: texturesData.textures?.SKIN?.url,
                        capeUrl: texturesData.textures?.CAPE?.url,
                        username: fullProfile.name,
                        uuid: fullProfile.id
                    };
                }
            }
            
            return { success: false, message: '未找到皮肤信息' };
        } catch (error) {
            // 完全屏蔽404错误
            if (error.message.includes('HTTP 404')) {
                return { success: false, message: '皮肤API 404', silent: true };
            }
            console.error('Yggdrasil API错误:', error.message);
            return { success: false, message: error.message };
        }
    }

    // Yggdrasil认证
    async authenticate(username, password) {
        try {
            console.log(`🔐 正在使用Yggdrasil认证用户: ${username}`);
            
            const authData = {
                agent: {
                    name: "Minecraft",
                    version: 1
                },
                username: username,
                password: password,
                clientToken: this.generateClientToken()
            };

            const response = await this.makeRequest(`${this.authServerURL}/authenticate`, 'POST', authData);
            
            if (response && response.accessToken) {
                console.log('✅ Yggdrasil认证成功！');
                return {
                    success: true,
                    accessToken: response.accessToken,
                    clientToken: response.clientToken,
                    selectedProfile: response.selectedProfile,
                    availableProfiles: response.availableProfiles,
                    user: response.user
                };
            }
            
            return { success: false, message: '认证失败' };
        } catch (error) {
            console.error('Yggdrasil认证错误:', error.message);
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

            await this.makeRequest(`${this.authServerURL}/validate`, 'POST', validateData);
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

            const response = await this.makeRequest(`${this.authServerURL}/refresh`, 'POST', refreshData);
            return {
                success: true,
                accessToken: response.accessToken,
                clientToken: response.clientToken,
                selectedProfile: response.selectedProfile
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
            const authDir = './yggdrasil_profiles';
            if (!fs.existsSync(authDir)) {
                fs.mkdirSync(authDir);
            }

            const authFile = path.join(authDir, `${username}.json`);
            fs.writeFileSync(authFile, JSON.stringify(authData, null, 2));
            console.log(`💾 Yggdrasil认证信息已保存: ${authFile}`);
        } catch (error) {
            console.error('保存认证信息失败:', error);
        }
    }

    // 加载认证信息
    loadAuthData(username) {
        try {
            const authFile = path.join('./yggdrasil_profiles', `${username}.json`);
            if (fs.existsSync(authFile)) {
                const authData = JSON.parse(fs.readFileSync(authFile, 'utf8'));
                console.log(`📁 加载Yggdrasil认证信息: ${username}`);
                return authData;
            }
        } catch (error) {
            console.error('加载认证信息失败:', error);
        }
        return null;
    }
}

module.exports = YggdrasilAPI;
