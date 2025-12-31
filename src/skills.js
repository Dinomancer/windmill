
// 技能基类
class Skill {
    constructor(id, name, description, isTargeted = true) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.isTargeted = isTargeted;
    }

    // 执行函数：需要重写
    async execute(attacker, target, callbacks) {
        console.warn(`${this.name} execute method not implemented.`);
    }
}

// 普通攻击技能
class AttackSkill extends Skill {
    constructor() {
        super('attack', '普通攻击', '造成等于攻击力的伤害', true);
    }

    async execute(attacker, target, callbacks) {
        const damage = attacker.atk;
        target.hp = Math.max(0, target.hp - damage);
        
        // 调用回调记录日志
        if (callbacks && callbacks.onLog) {
            await callbacks.onLog(`⚔️ ${attacker.name} 使用 ${this.name} 攻击了 ${target.name}，造成 ${damage} 点伤害！`);
        }
        
        // 击败判定
        if (target.hp === 0) {
            if (callbacks && callbacks.onLog) {
                await callbacks.onLog(`💀 ${target.name} 被击败了！`);
            }
        }
    }
}

// 混乱三连击技能
class ChaosTripleStrikeSkill extends Skill {
    constructor() {
        super('chaos_triple', '混乱三连击', '随机攻击3次，目标随机（包含自己）', false);
    }

    async execute(attacker, target, callbacks) {
        if (!callbacks || !callbacks.getCharacters) {
            console.error("ChaosTripleStrikeSkill requires getCharacters callback");
            return;
        }

        const characters = callbacks.getCharacters();
        
        for (let i = 0; i < 3; i++) {
            // 每次攻击都重新寻找存活目标（允许包含自己）
            const validTargets = characters.filter(c => !c.isDead);
            
            if (validTargets.length === 0) {
                if (callbacks.onLog) await callbacks.onLog(`${attacker.name} 找不到目标，攻击中止！`);
                break;
            }

            const randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
            const damage = attacker.atk;
            randomTarget.hp = Math.max(0, randomTarget.hp - damage);

            if (callbacks.onLog) {
                if (randomTarget.id === attacker.id) {
                    await callbacks.onLog(`🎲 [第${i+1}击] ${attacker.name} 在混乱中弄伤了自己，受到 ${damage} 点伤害！`);
                } else {
                    await callbacks.onLog(`🎲 [第${i+1}击] ${attacker.name} 混乱攻击 ${randomTarget.name}，造成 ${damage} 点伤害！`);
                }
            }

            if (randomTarget.hp === 0) {
                if (callbacks.onLog) {
                    await callbacks.onLog(`💀 ${randomTarget.name} 被击败了！`);
                }
            }

            // 如果施法者自己死亡，中止后续攻击
            if (attacker.isDead) {
                if (callbacks.onLog) await callbacks.onLog(`${attacker.name} 已死亡，攻击中止！`);
                break;
            }
        }
    }
}

// 全局技能注册表
window.SKILLS = {
    Attack: new AttackSkill(),
    ChaosTripleStrike: new ChaosTripleStrikeSkill()
};
