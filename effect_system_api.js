/*
Copyright (c) 2026 葉部篇

利用許諾

本スクリプトの利用、改変、組み込み、および他のソフトウェアへの同梱を許可します。
本スクリプトを利用したソフトウェアの公開、配布、および商用利用を許可します。

禁止事項
以下の行為を禁止します。

* 本スクリプト単体での再配布
* 著作権表示の削除
* 作者を偽る行為

免責事項

本スクリプトは現状のまま提供されます。
作者は、本スクリプトの利用または利用不能によって生じた損害について、一切の責任を負いません。
*/

// https://github.com/HABUPENN/effect_system



import { system } from "@minecraft/server"

/**
 * エフェクトシステムへ効果を登録する。
 * 
 * base/add/mul の各レイヤーへ値を追加し、
 * 最終的な effect amplifier を再計算する。
 * 
 * @param {import("@minecraft/server").Entity} entity
 * 効果対象のエンティティ
 * 
 * @param {string} id
 * 効果の一意ID。
 * 同じIDを再利用すると既存効果を上書きする。
 * 
 * @param {"base"|"add"|"mul"} type
 * 効果タイプ
 * 
 * - base : 基礎値加算(BASE)
 * - add  : 加算倍率(SCALE)
 * - mul  : 乗算倍率(MULTIPLIER)
 * 
 * @param {string} effect
 * Minecraftのeffect ID
 * 
 * @param {number} power
 * 効果量
 * 
 * 例:
 * - base : 10
 * - add  : 0.5 (= +50%)
 * - mul  : 2 (= ×2)
 * 
 * @param {string} name
 * 表示名(翻訳キー可)
 * 
 * @param {?number} [time=null]
 * 効果時間(tick)
 * null の場合は永続効果
 */
export function setEffect(entity, id, type, effect, power, name, time = null) {
    system.sendScriptEvent(
        "effect_system:set_effect",
        JSON.stringify({
            target: entity.id,
            id,
            type,
            effect,
            power,
            name,
            time
        })
    );
}
/**
 * effect_system から同期されたエフェクト状態キャッシュ。
 * 
 * target(entity.id) ごとに effect の現在値を保持する。
 * 
 * 例:
 * Effects[player.id]["custom:reflect_rate"].amp
 * 
 * 注意:
 * 外部から直接変更しないこと。
 * 値は effect_system:update_effect により同期される。
 * 
 * @type {{
 *   [target:string]:{
 *     [effect:string]:{
 *         amp:number,
 *         seq:number
 *     }
 *   }
 * }}
 */
export const Effects = {};
let lastSeq = -1;

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id == "effect_system:update_effect") {
        let json = JSON.parse(message);
        if (!Effects[json.target]) Effects[json.target] = {};
        if (!Effects[json.target][json.effect]) Effects[json.target][json.effect] = { amp: 0, seq: -1 };
        if (Effects[json.target][json.effect].seq < json.seq) {
            Effects[json.target][json.effect].amp = json.amp;
            Effects[json.target][json.effect].seq = json.seq;
        }
    }
}, { namespaces: ["effect_system"] });

/**
 * エフェクトの現在値を取得する。
 * 
 * minecraft:effect と custom effect の両方に対応する。
 * 
 * @param {import("@minecraft/server").Entity} entity
 * 対象エンティティ
 * 
 * @param {string} effect
 * effect ID
 * 
 * @returns {number}
 * 現在のeffect値。
 * effectが存在しない場合は0。
 */
export function getEffect(entity, effect) {

    if (effect.startsWith("minecraft:")) {
        let e = entity.getEffect(effect);
        return e ? e.amplifier + 1 : 0;
    }

    return Effects[entity.id]?.[effect]?.amp ?? 0;
}