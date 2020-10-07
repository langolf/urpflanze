import { IRepetition, ISceneChildProps, ISceneChildSettings, TSceneChildProp } from "./scene-child";
import SceneChild from "../SceneChild";
import { TVertexCallback } from "./shape-primitive";
import ShapeBase from "../shapes/ShapeBase";
/**
 * Object for index the buffer
 * @category Core.Interfaces
 */
export interface IBufferIndex {
    shape: ShapeBase;
    parent?: IBufferIndex;
    frame_length: number;
    repetition: IRepetition;
}
export interface IShapeBaseSettings extends ISceneChildSettings {
    bUseParent?: boolean;
}
export interface IShapeSettings extends IShapeBaseSettings {
    shape?: SceneChild;
}
export declare enum EShapePrimitiveAdaptMode {
    /**
     * @order 1
     */
    None = 0,
    /**
     * @order 2
     */
    Scale = 2,
    /**
     * @order 3
     */
    Center = 4,
    /**
     * @order 4
     */
    Fill = 8
}
export interface IShapePrimitiveProps extends ISceneChildProps {
    sideLength?: TSceneChildProp<number | Array<number>>;
    fillColor?: TSceneChildProp<number | string>;
    lineWidth?: TSceneChildProp<number>;
    strokeColor?: TSceneChildProp<number | string>;
}
export interface IShapePrimitiveSettings extends IShapePrimitiveProps, IShapeBaseSettings {
    adaptMode?: EShapePrimitiveAdaptMode;
    bCloseShape?: boolean;
    vertexCallback?: TVertexCallback;
}
export interface IShapeBounding {
    x: number;
    y: number;
    cx: number;
    cy: number;
    width: number;
    height: number;
}
//# sourceMappingURL=shape-base.d.ts.map