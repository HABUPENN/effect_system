# Effect System
## 概要

このアドオンはEffectSystemAPIを使う複数のアドオンの効果を同時に機能させることができます。  
同一のエフェクトを二つのアドオンから追加するとどちらかが無効になります。  
そこで、アドオンの効果付与を管理し、重ね掛けすることで組み合わせインフレを楽しもうと考えて作ったアドオンです

## 計算式

Effect System は追加されたエフェクトを全て確認できるため、単なる加算以上の効果を発揮できます。  
エフェクトは base・add・mul の3レイヤーで構成され、それらを組み合わせて最終的な効果値を算出します。
効果そのものを付与する場合はbase、効果の効き方を上げる場合はadd、効果そのものを強くする場合はmulが良いです。

    (base全ての和)*(add全ての和 +1)*(mul全ての積)

## 追加コマンド
`effect_system:`から始まる4つのコマンド。省略して記載。
### effectgui
エフェクトの状況をGUIで表示するコマンド
### effectlist
今ついているエフェクトを一覧で確認するコマンド
### effectinfo
エフェクトを指定して状態を確認するコマンド
### effectset (チート)
エフェクトをエフェクトシステムの方法で付与するコマンド

## ScriptEventAPI
### 表示,非表示の切り替え
Effect System ではコマンドで確認できないエフェクトを登録するシステムがあります。  
プレーヤーに確認されたくない効果がある場合活用しましょう。  
登録と解除は、ScriptEventを送信して行います。
#### Event ID
`effect_system:hide_effect`,`effect_system:show_effect`
#### Message Structure(String)
例:`jump_boost`

### 値の設定
Effect System ではレイヤー内に、IDで管理された時間と強度を保持しています。  
各アドオンは、IDを使用しエフェクトの状態を変更できます。  
状態の変更は、ScriptEventを送信して行います。
#### Event ID
`effect_system:set_effect`
#### Message Structure(JSON文字列)
例
```json
{
    "target": "< エンティティのID >",
    "id": "namespace:id",
    "type": "base",
    "effect": "speed",
    "power": 1,
    "name": "speed_item.effect",
    "time": 200
}
```
- target  
エンティティのID TypeIdではない
- id  
エフェクトの設定ID 同レイヤーに同IDの設定があれば上書きされる。
- type  
効果の付与方法。base / add / mul
- effect  
効果の指定 バニラエフェクトの場合プレーヤーの状態としてパーティクル等で確認可能  
minecraft以外のnamespaceを使用するとカスタム効果となり他のアドオンからでも確認が可能
- power  
効果の強さ base,addは0、mulは1を設定すると効果が削除される
- name  
効果の表示名 翻訳キーを使うことも可能
- time  
指定する場合効果時間をtickで指定 設定しない場合無期限

### 値の取得
Effect System はカスタム効果が変更された時にScriptEventを送信します。  
各アドオンは受信したMessageから情報を更新することで最新の状態を確認できます。
#### Event ID
`effect_system:update_effect`
#### Message Structure(JSON文字列)
```json
{
    "seq": 12,
    "target": "entity id",
    "effect": "namespace:id",
    "amp": 1.5
}
```
- seq  
更新順序を判定するためのシーケンス番号
- target  
更新があったエンティティのID
- effect  
カスタム効果のID
- amp
カスタム効果の強度

## 同期モデル
Addon  
↓ effect_system:set_effect  
Effect System  
↓ effect_system:update_effect  
Addon

このため、エフェクトの設定後、即座に値を取得できる訳ではない。

# Effect System API Library
Effect System を簡単に操作するためのライブラリ。  
Effect System の SriptEvent API は低レベルの処理であり複雑。  
このライブラリは ScriptEvent API の送受信を関数化したもの。
## 定数
### Effects
エフェクトの同期用のオブジェクト。値の変更はすべきでない。
```ts
{
    [target:string]:{
        [effect:string]:{
            amp:number,
            seq:number
        }
    }
}
```
- target  
エンティティのID
- effect  
カスタム効果のID
- amp  
効果の強度
- seq  
シーケンス この値を更新した最後のイベント
## 関数
### setEffect
エンティティに効果を付与する関数 内部でeffect_system:set_effectのScriptEventを送信している
```js
setEffect(entity: @minecraft/server.entity, id: string, type: "base" | "add" | "mul", effect: string, power: number, name: string, time?: number | null | undefined): void
```
- entity  
対象のエンティティ
- id  
エフェクトの設定ID
- type  
効果の付与方法。
- effect  
効果の指定 バニラエフェクトの場合プレーヤーの状態としてパーティクル等で確認可能  
minecraft以外のnamespaceを使用するとカスタム効果となり他のアドオンからでも確認が可能
- power  
効果の強度
- name  
効果の表示名 翻訳キーを使うことも可能
- time  
指定する場合効果時間をtickで指定 設定しない場合無期限

### getEffect
エンティティの効果を取得する関数 内部でeffect_system:update_effectから取得した情報を読んでいる
```js
getEffect(entity: @minecraft/server.entity, effect: string)
```
- entity  
効果を確認するエンティティ
- effect  
確認する効果のID バニラ効果も可能

### hideEffect
エフェクトシステムのコマンドで確認できないエフェクトを登録する関数
```js
hideEffect(effect: string)
```

- effect  
効果の指定

### showEffect
エフェクトシステムのコマンドで確認できないエフェクトを登録解除する関数
```js
showEffect(effect: string)
```

- effect  
効果の指定

## ライセンス

このプロジェクトは独自ライセンスで公開されています。

ソースコードの閲覧・解析は自由です。

本プロジェクトに依存するアドオンやプラグインの作成、およびそれらへの同梱を許可します。

ただし、本プロジェクト単体での再配布や、本プロジェクトの配布を主目的とする再配布は禁止します。

詳細は LICENSE ファイルを参照してください。
