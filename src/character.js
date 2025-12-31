// 角色类
class Character {
    constructor(id, name, hp, atk, isPlayer, skills) {
        this.id = id;
        this.name = name;
        this.hp = hp;
        this.maxHp = hp;
        this.atk = atk;
        this.isPlayer = isPlayer;
        this.skills = skills || [];
    }

    // 判断角色是否死亡
    get isDead() {
        return this.hp <= 0;
    }
}
