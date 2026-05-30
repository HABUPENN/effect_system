import { system, world } from "@minecraft/server"
import { ActionFormData } from "@minecraft/server-ui"

// 状態確認用コマンドの実装
system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    customCommandRegistry.registerCommand({
        cheatsRequired: false,
        name: "effect_system:effectlist",
        description: "",
        permissionLevel: 0
    }, ({ sourceEntity }) => {
        system.run(() => {
            if (sourceEntity) {
                let effectList = JSON.parse(sourceEntity.getDynamicProperty("effect_list") || "[]");
                sourceEntity.sendMessage(effectList.join("\n"));
            }
        })
    })
    customCommandRegistry.registerCommand({
        cheatsRequired: false,
        name: "effect_system:effectinfo",
        description: "",
        permissionLevel: 0,
        mandatoryParameters: [
            { name: "effect", type: "String" }
        ]
    }, ({ sourceEntity }, params) => {
        system.run(() => {
            if (sourceEntity) {
                let power = JSON.parse(sourceEntity.getDynamicProperty(params) || '{"base":{},"add":{},"mul":{}}');
                sourceEntity.sendMessage(formatEffect(power, params));
            }
        })
    })
    customCommandRegistry.registerCommand({
        cheatsRequired: false,
        name: "effect_system:effectgui",
        description: "",
        permissionLevel: 0
    }, ({ sourceEntity }) => {
        system.run(() => {
            if (sourceEntity) {
                showEffectUI(sourceEntity, "");
            }
        })
    })
    //customCommandRegistry.registerEnum("effect_system:type", ["base", "add", "mul"]);
    customCommandRegistry.registerCommand({
        cheatsRequired: true,
        name: "effect_system:effectset",
        description: "",
        permissionLevel: 1,
        mandatoryParameters: [
            { name: "target", type: "EntitySelector" },
            { name: "id", type: "String" },
            { name: "effect", type: "String" },
            { name: "name", type: "String" },
            { name: "type(base|add|mul)", type: "String" },
            { name: "power", type: "Float" },
        ],
        optionalParameters: [
            { name: "tick", type: "Integer" },
        ]
    }, ({ sourceEntity }, target, id, effect, name, type, power, tick) => {
        target.forEach(e => {
            setEffect(e, {
                type,
                id,
                effect,
                name,
                power: power,
                time: tick,
                target: e.id
            })
        })
    })
})

function showEffectUI(entity, main) {
    let effectList = JSON.parse(entity.getDynamicProperty("effect_list") || "[]");
    let form = new ActionFormData().body(main);
    effectList.forEach(e => {
        let power = JSON.parse(entity.getDynamicProperty(e) || '{"base":{},"add":{},"mul":{}}');
        let name = formatName(e);
        form = form.button({
            rawtext: [
                { translate: `potion.${name}` },
                { text: `: ${calcEffect(power)}\n` }
            ]
        }, `textures/ui/${e.replace("minecraft:", "").replace(":", "/")}_effect`)
    })
    form.show(entity).then(({ canceled,selection }) => {
        if (!canceled)showEffectUI(
            entity,
            formatEffect(JSON.parse(entity.getDynamicProperty(effectList[selection]) || '{"base":{},"add":{},"mul":{}}'),effectList[selection])
        );
    })
}

const effectName2translate = {
    speed: "moveSpeed",
    slowness: "moveSlowdown",
    haste: "digSpeed",
    mining_fatigue: "digSlowDown",
    strength: "damageBoost",
    jump_boost: "jump",
    nausea: "confusion",
    fatal_poison: "poison",
    darkness: "blindness"
}

function formatName(e) {
    let name = e;
    if (e.startsWith("minecraft:")) name = e.slice(10);
    name = toCamelCase(name);
    if (effectName2translate[name]) name = effectName2translate[name];
    return name;
}

// 確認用文字列の整形
function formatEffect(power, name) {
    let fName = formatName(name);
    let lines = [{ translate: `potion.${fName}` }, { text: `: ${calcEffect(power)}\n` }];
    [["base", "+", "", 1, "§a[BASE]"], ["add", "+", "％", 100, "§6[SCALE]"], ["mul", "x", "％", 100, "§d[MULTIPLIER]"]].forEach(type => {
        lines.push({ text: type[4] });
        Object.keys(power[type[0]]).forEach(id => {
            lines.push({ text: "\n [" + type[1] + (power[type[0]][id].power * type[3]) + type[2] + "] " });
            lines.push({ translate: power[type[0]][id].name });
            if (power[type[0]][id].end) lines.push({ text: ` (${formatTime(power[type[0]][id].end - system.currentTick)})` });
        });
        lines.push({ text: "\n" });
    });
    return { rawtext: lines };
}
function toCamelCase(str) {
    if (!str.includes(":")) {
        return str
            .toLowerCase()
            .replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''));
    } else {
        let a = str.split(":");
        return a[0] + ":" + a[1]
            .toLowerCase()
            .replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''));
    }
}

// Tick単位の時間を整形
function formatTime(num) {
    let t = num % 20;
    let s = pad(Math.floor((num / 20) % 60));
    let m = pad(Math.floor((num / 1200) % 60));
    let h = pad(Math.floor((num / 72000) % 24));
    let d = pad(Math.floor(num / 1728000));
    let res = ``;
    if (1728000 <= num) res += `${d}/`;
    if (72000 <= num) res += `${h}:`;
    if (1200 <= num) res += `${m}:`;
    if (20 <= num) res += `${s}.${t}`;
    res += `[${num}]`
    return res;
}
function pad(n) {
    return String(n).padStart(2, "0");
}

// プレーヤー参加時とリスポーン時に時間制限付き効果を削除
world.afterEvents.playerSpawn.subscribe(({ player }) => {
    let effectList = JSON.parse(player.getDynamicProperty("effect_list") || "[]");
    effectList.forEach(e => {
        let power = JSON.parse(player.getDynamicProperty(e));
        ["base", "add", "mul"].forEach(type => {
            Object.keys(power[type]).forEach(id => {
                if (power[type][id].runId) {
                    delete power[type][id];
                }
            });
        });
        addEffect(player, e, calcEffect(power));
        player.setDynamicProperty(
            e,
            JSON.stringify(power)
        );
    })
})

// バニラのエフェクトを可能な限り再現
world.afterEvents.effectAdd.subscribe(({ entity, effect }) => {
    if (effect.isValid && effect.duration < 10000000) setEffect(entity, {
        type: "base",
        id: "minecraft:vanilla",
        effect: effect.typeId,
        power: effect.amplifier + 1,
        name: "vanilla",
        time: effect.duration,
        target: entity.id
    });
}, { entityTypes: ["minecraft:player"] })

// 処理本体
system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id == "effect_system:set_effect") {
        let json = JSON.parse(message);
        let player = world.getEntity(json.target);
        setEffect(player, json);
    }
}, { namespaces: ["effect_system"] });

// エフェクト付与関数
function setEffect(player, json) {
    if (!player) return;
    if (!json.effect.includes(":")) json.effect = "minecraft:" + json.effect;
    let power = JSON.parse(
        player.getDynamicProperty(json.effect) ??
        '{"base":{},"add":{},"mul":{}}'
    );
    if (power[json.type][json.id]) {
        if (power[json.type][json.id].runId) system.clearRun(power[json.type][json.id].runId);
    }
    let data = {};
    if (json.power) data.power = json.power;
    if (json.name) data.name = json.name;
    if (json.time) {
        data.end = system.currentTick + json.time;
        data.runId = system.runTimeout(() => {
            let player = world.getEntity(json.target);
            if (!player) return;
            let power = JSON.parse(player.getDynamicProperty(json.effect));
            delete power[json.type][json.id];
            if (0 != Object.keys(power.base).length + Object.keys(power.add).length + Object.keys(power.mul).length) {
                player.setDynamicProperty(json.effect, JSON.stringify(power));
            } else {
                player.setDynamicProperty(json.effect);
            }
            addEffect(player, json.effect, calcEffect(power));
        }, json.time)
    }
    if (json.power == { base: 0, add: 0, mul: 1 }[json.type]) {
        if (power[json.type][json.id]) {
            delete power[json.type][json.id];
        }
    } else {
        power[json.type][json.id] = data;
    }
    if (0 != Object.keys(power.base).length + Object.keys(power.add).length + Object.keys(power.mul).length) {
        player.setDynamicProperty(json.effect, JSON.stringify(power));
    } else {
        player.setDynamicProperty(json.effect);
    }
    addEffect(player, json.effect, calcEffect(power));
}

// プレーヤーへの設定
let seq = 0;
function addEffect(player, effect, amp) {
    let effectList = JSON.parse(player.getDynamicProperty("effect_list") || "[]");
    if (0 < amp) {
        if (!effectList.includes(effect)) effectList.push(effect);
    } else {
        effectList = effectList.filter(e => e !== effect);
    }
    if (effect.startsWith("minecraft:")) {
        player.removeEffect(effect);
        if (0 < amp) {
            player.addEffect(effect, 20000000, { amplifier: Math.min(255, Math.max(amp - 1, 0)), showParticles: false });
        }
    } else {
        system.sendScriptEvent("effect_system:update_effect", JSON.stringify({
            seq: seq++,
            target: player.id,
            effect: effect,
            amp: amp
        }))
    }
    player.setDynamicProperty("effect_list", JSON.stringify(effectList));
}

// エフェクトの効果を処理
function calcEffect(pow) {
    let a = 0, b = 1, c = 1;
    Object.values(pow.base).forEach(e => {
        a += e.power;
    })
    Object.values(pow.add).forEach(e => {
        b += e.power;
    })
    Object.values(pow.mul).forEach(e => {
        c *= e.power;
    })
    return a * b * c
}