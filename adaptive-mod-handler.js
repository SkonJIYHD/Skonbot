
// 自适应mod列表处理器
// 这个模块会在机器人连接服务器时自动检测并伪装mod列表

class AdaptiveModHandler {
    constructor() {
        this.detectedMods = [];
        this.isEnabled = process.env.ADAPTIVE_MODS === 'true';
        this.manualMods = [];
        
        if (process.env.FAKE_MODS) {
            try {
                this.manualMods = JSON.parse(process.env.FAKE_MODS);
            } catch (e) {
                console.log('解析手动mod列表失败:', e);
            }
        }
        
        console.log('自适应mod处理器初始化:', {
            enabled: this.isEnabled,
            manualMods: this.manualMods.length
        });
    }
    
    // 解析服务器发送的mod列表数据包
    parseModListPacket(packet) {
        try {
            // 检测Forge mod列表数据包 (通常是自定义channel)
            if (packet.channel && packet.channel.includes('forge')) {
                return this.parseForgeModList(packet.data);
            }
            
            // 检测FML mod列表数据包
            if (packet.channel && packet.channel.includes('fml')) {
                return this.parseFMLModList(packet.data);
            }
            
            // 检测Fabric mod列表数据包
            if (packet.channel && packet.channel.includes('fabric')) {
                return this.parseFabricModList(packet.data);
            }
            
            return [];
        } catch (error) {
            console.log('解析mod列表数据包失败:', error);
            return [];
        }
    }
    
    // 解析Forge mod列表
    parseForgeModList(data) {
        const mods = [];
        try {
            // Forge通常使用特定的数据格式
            if (Buffer.isBuffer(data)) {
                const str = data.toString('utf8');
                // 查找mod ID模式
                const modPattern = /mod[_\s]*id[:\s]*["']([^"']+)["']/gi;
                let match;
                while ((match = modPattern.exec(str)) !== null) {
                    mods.push(match[1]);
                }
            }
        } catch (e) {
            console.log('解析Forge mod列表失败:', e);
        }
        return mods;
    }
    
    // 解析FML mod列表
    parseFMLModList(data) {
        const mods = [];
        try {
            if (Buffer.isBuffer(data)) {
                // FML数据包格式解析
                const str = data.toString('utf8');
                const lines = str.split('\n');
                lines.forEach(line => {
                    if (line.includes('modid') || line.includes('mod_id')) {
                        const match = line.match(/[:\s]([a-zA-Z0-9_-]+)/);
                        if (match) mods.push(match[1]);
                    }
                });
            }
        } catch (e) {
            console.log('解析FML mod列表失败:', e);
        }
        return mods;
    }
    
    // 解析Fabric mod列表
    parseFabricModList(data) {
        const mods = [];
        try {
            if (Buffer.isBuffer(data)) {
                const str = data.toString('utf8');
                // Fabric mod ID模式
                const modPattern = /"id"\s*:\s*"([^"]+)"/g;
                let match;
                while ((match = modPattern.exec(str)) !== null) {
                    mods.push(match[1]);
                }
            }
        } catch (e) {
            console.log('解析Fabric mod列表失败:', e);
        }
        return mods;
    }
    
    // 处理接收到的数据包
    handlePacket(packet) {
        if (!this.isEnabled) {
            return this.manualMods; // 返回手动配置的mod列表
        }
        
        // 检测是否是mod列表相关的数据包
        if (this.isModListPacket(packet)) {
            const detectedMods = this.parseModListPacket(packet);
            if (detectedMods.length > 0) {
                this.detectedMods = [...new Set([...this.detectedMods, ...detectedMods])];
                console.log('检测到服务器mod列表:', detectedMods);
                console.log('当前累计mod列表:', this.detectedMods);
            }
        }
        
        return this.getCurrentModList();
    }
    
    // 检查是否是mod列表数据包
    isModListPacket(packet) {
        if (!packet) return false;
        
        // 检查自定义channel
        if (packet.channel) {
            const channel = packet.channel.toLowerCase();
            return channel.includes('forge') || 
                   channel.includes('fml') || 
                   channel.includes('fabric') ||
                   channel.includes('mod');
        }
        
        // 检查数据内容
        if (packet.data) {
            const dataStr = packet.data.toString().toLowerCase();
            return dataStr.includes('modid') || 
                   dataStr.includes('mod_id') ||
                   dataStr.includes('modlist') ||
                   dataStr.includes('"id"');
        }
        
        return false;
    }
    
    // 获取当前应该使用的mod列表
    getCurrentModList() {
        if (this.isEnabled && this.detectedMods.length > 0) {
            return this.detectedMods;
        }
        return this.manualMods;
    }
    
    // 生成mod列表响应数据包
    generateModListResponse(requiredMods = null) {
        const modList = requiredMods || this.getCurrentModList();
        
        if (modList.length === 0) {
            return null;
        }
        
        // 构造标准的mod列表响应
        const response = {
            mods: modList.map(modId => ({
                modid: modId,
                version: "1.0.0", // 默认版本
                name: modId,
                clientSideRequired: false
            }))
        };
        
        console.log('生成mod列表响应:', response);
        return JSON.stringify(response);
    }
    
    // 添加常见的必需mod（防止检测失败）
    addFallbackMods() {
        const fallbackMods = ['forge', 'minecraft'];
        this.detectedMods = [...new Set([...this.detectedMods, ...fallbackMods])];
    }
}

module.exports = AdaptiveModHandler;
