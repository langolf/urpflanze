import { mat4, vec2, vec3 } from 'gl-matrix'

import { IParentBufferIndex, IShapeBaseSettings, IShapeBounding, TVertexCallback } from '@core/types/shape-base'
import {
	ERepetitionType,
	IRepetition,
	IBaseRepetition,
	ISceneChildPropArguments,
	ISceneChildProps,
	IStreamArguments,
} from '@core/types/scene-child'
import { IBufferIndex } from '@core/types/shape-base'
import { clamp } from 'src/Utilites'
import * as glme from '@core/math/gl-matrix-extensions'
import Vec2 from '@core/math/Vec2'
import { PI2 } from '@core/math'

import Bounding from '@core/math/bounding'
import SceneChild from '@core/SceneChild'

const tmpMatrix = mat4.create()
const transformMatrix = mat4.create()
const perspectiveMatrix = mat4.create()
const repetitionMatrix = mat4.create()

/**
 * Main class for shape generation
 *
 * @category Core.Abstract
 * @abstract
 * @class ShapeBase
 * @order 4
 * @extends {SceneChild}
 */
abstract class ShapeBase<GShapeBaseProps extends ISceneChildProps = ISceneChildProps> extends SceneChild {
	/**
	 * Empty buffer
	 *
	 * @internal
	 * @ignore
	 */
	public static readonly EMPTY_BUFFER: Float32Array = new Float32Array(0)

	/**
	 * Empty BaseRepetition
	 *
	 * @internal
	 * @ignore
	 */
	public static getEmptySimpleRepetition: () => IBaseRepetition = () => ({
		index: 1,
		offset: 1,
		count: 1,
	})
	/**
	 * Empty Repetition
	 *
	 * @internal
	 * @ignore
	 */
	public static getEmptyRepetition: () => IRepetition = () => ({
		type: ERepetitionType.Ring,
		angle: 0,
		...ShapeBase.getEmptySimpleRepetition(),
		row: ShapeBase.getEmptySimpleRepetition(),
		col: ShapeBase.getEmptySimpleRepetition(),
	})

	/**
	 *
	 */
	protected props: GShapeBaseProps

	/**
	 * Shape generation id
	 * used for prevent buffer calculation
	 *
	 * @internal
	 * @ignore
	 */
	protected generateId = -1

	/**
	 * A final array of vertices to draw
	 *
	 * @internal
	 * @ignore
	 */
	protected buffer?: Float32Array

	/**
	 * Determine if shape are static and doon't need generate at eachtime
	 *
	 * @internal
	 * @ignore
	 */
	protected bStatic!: boolean

	/**
	 * Determine if shape have static indexed buffer
	 *
	 * @internal
	 * @ignore
	 */
	protected bStaticIndexed!: boolean

	/**
	 * Flag used to determine if indexedBuffer has been generated
	 *
	 * @internal
	 * @ignore
	 */
	protected bIndexed = false

	/**
	 * With this parameter the shape will be created at each repetition,
	 * useful if you want to encapsulate this shape in another and use its <mark>repetition</mark> object.
	 * In the case of ShapePrimitive fillColor, strokeColor and lineWidth don't need to as they are generated during the buffer stream.
	 *
	 * @public
	 * @type {boolean}
	 * @example
	 * ```javascript
	 * // Use parent repetition for generate different types of roses
	 *
	 * const rose = new Urpflanze.Rose({
	 * 	repetitions: 3,
	 * 	n: ({ parent }) => parent.repetition.index, // <- use parent
	 * 	d: ({ repetition }) => repetition.index,
	 * 	sideLength: 20,
	 * 	distance: 30,
	 * 	bUseParent: true // <- add this for use `parent` as propArgument of `n` property
	 * })
	 *
	 * const shape = new Urpflanze.Shape({
	 * 	shape: rose,
	 * 	repetitions: 4,
	 * 	distance: 100
	 * })
	 * ```
	 */
	public bUseParent: boolean

	/**
	 * With this parameter the shape will be created at each recursion,
	 * In the case of ShapePrimitive fillColor, strokeColor and lineWidth don't need to as they are generated during the buffer stream.
	 *
	 * @public
	 * @type {boolean}
	 * @example
	 * ```javascript
	 * // Use recursion for generate different types of roses
	 *
	 * const rose = new Urpflanze.Rose({
	 * 	repetitions: 3,
	 * 	n: ({ parent }) => parent.repetition.index, // <- use parent
	 * 	d: ({ repetition }) => repetition.index,
	 * 	sideLength: 20,
	 * 	distance: 30,
	 * 	bUseParent: true // <- add this for use `parent` as propArgument of `n` property
	 * })
	 *
	 * const shape = new Urpflanze.Shape({
	 * 	shape: rose,
	 * 	repetitions: 4,
	 * 	distance: 100
	 * })
	 * ```
	 */
	public bUseRecursion: boolean

	/**
	 * Array used for index a vertex buffer
	 * only for first level scene children
	 *
	 * @internal
	 * @ignore
	 */
	protected indexedBuffer: Array<IBufferIndex> = []

	/**
	 * Callback to apply transform at any vertex
	 *
	 * @example
	 * ```javascript
	 * // vertexCallback example
	 * // Generate lines with noise
	 *
	 * const line = new Urpflanze.Line({
	 * 	repetitions: [1, 50],
	 * 	distance: [0, 4],
	 * 	sideLength: ({ context, shape }) => context.percW(40, shape), // <- make the shape non-static
	 * 	vertexCallback: (vertex, { repetition, context, time }, vertex_repetition) => {
	 * 		const noise = context.noise('seed', vertex_repetition.offset * 2, repetition.row.offset * 2, time / 1000)
	 * 		vertex[0] += noise * 10
	 * 		vertex[1] += noise * 10
	 * 	},
	 * })
	 *
	 * line.subdivide(5)
	 * ```
	 */
	public vertexCallback?: TVertexCallback

	/**
	 * The bounding inside the scene
	 *
	 * @type {IShapeBounding}
	 */
	public bounding: IShapeBounding = {
		cx: 0,
		cy: 0,
		x: -1,
		y: -1,
		width: 2,
		height: 2,
	}

	/**
	 * Creates an instance of ShapeBase
	 *
	 * @param {ISceneChildSettings} [settings={}]
	 */
	constructor(settings: IShapeBaseSettings = {}) {
		super(settings)

		this.props = {
			distance: settings.distance,
			repetitions: settings.repetitions,

			rotateX: settings.rotateX,
			rotateY: settings.rotateY,
			rotateZ: settings.rotateZ,
			skewX: settings.skewX,
			skewY: settings.skewY,
			squeezeX: settings.squeezeX,
			squeezeY: settings.squeezeY,
			displace: settings.displace,
			translate: settings.translate,
			scale: settings.scale,
			transformOrigin: settings.transformOrigin,
			perspective: settings.perspective,
			perspectiveOrigin: settings.perspectiveOrigin,
		} as GShapeBaseProps

		this.bUseParent = !!settings.bUseParent
		this.bUseRecursion = !!settings.bUseRecursion

		this.vertexCallback = settings.vertexCallback
	}

	/**
	 * Check if the shape should be generated every time
	 *
	 * @returns {boolean}
	 */
	public isStatic(): boolean {
		const props = this.props

		return (
			typeof props.distance !== 'function' &&
			typeof props.repetitions !== 'function' &&
			typeof props.rotateX !== 'function' &&
			typeof props.rotateY !== 'function' &&
			typeof props.rotateZ !== 'function' &&
			typeof props.displace !== 'function' &&
			typeof props.skewX !== 'function' &&
			typeof props.skewY !== 'function' &&
			typeof props.squeezeX !== 'function' &&
			typeof props.squeezeY !== 'function' &&
			typeof props.translate !== 'function' &&
			typeof props.scale !== 'function' &&
			typeof props.transformOrigin !== 'function'
		)
	}

	/**
	 * Check if the indexedBuffer array needs to be recreated every time,
	 * this can happen when a shape generates an array of vertices different in length at each repetition
	 *
	 * @returns {boolean}
	 */
	public isStaticIndexed(): boolean {
		return typeof this.props.repetitions !== 'function'
	}

	/**
	 * Return a prop value
	 *
	 * @param {keyof ISceneChildProps} key
	 * @param {ISceneChildPropArguments} [propArguments]
	 * @param {*} [defaultValue]
	 * @returns {*}
	 */
	public getProp<K extends keyof GShapeBaseProps>(
		key: K,
		propArguments?: ISceneChildPropArguments,
		defaultValue?: number | vec2
	): any {
		let attribute: any = (this.props as any)[key] as any

		if (typeof attribute === 'function') {
			attribute = attribute(propArguments)
		}

		return typeof attribute === 'undefined' || Number.isNaN(attribute) ? defaultValue : attribute
	}

	/**
	 * Set a single or multiple props
	 *
	 * @param {(keyof ISceneChildProps | ISceneChildProps)} key
	 * @param {*} [value]
	 * @param {boolean} [bClearIndexed=false]
	 */
	public setProp(key: keyof ISceneChildProps | ISceneChildProps, value?: any, bClearIndexed = false): void {
		if (typeof key == 'string') {
			bClearIndexed = bClearIndexed || key == 'repetitions'
			this.props[key] = value
		} else {
			bClearIndexed = bClearIndexed || 'repetitions' in key
			Object.keys(key).forEach(
				(k: string) =>
					(this.props[k as keyof ISceneChildProps] = (key as ISceneChildProps)[k as keyof ISceneChildProps] as any)
			)
		}
		this.clearBuffer(bClearIndexed)
	}
	/**
	 *  Unset buffer
	 *
	 * @param {boolean} [bClearIndexed=false]
	 * @param {boolean} [bPropagateToParents=false]
	 * @param {boolean} [bPropagateToChildren=false]
	 */
	public clearBuffer(bClearIndexed = false, bPropagateToParents = true): void {
		this.buffer = undefined

		if (bClearIndexed) {
			this.bIndexed = false
		}

		this.bStatic = this.isStatic()
		this.bStaticIndexed = this.isStaticIndexed()

		if (bPropagateToParents && this.scene && !this.scene.isFirstLevelChild(this)) {
			const parents = this.scene.getParentsOfSceneChild(this)
			parents.length > 0 && parents[parents.length - 1].clearBuffer(bClearIndexed, bPropagateToParents /* true */)
		}
	}

	/**
	 * Update the vertex array if the shape is not static and update the indexedBuffer if it is also not static
	 *
	 * @param {number} generateId generation id
	 * @param {boolean} [bDirectSceneChild=false] adjust shape of center of scene
	 * @param {ISceneChildPropArguments} [parentPropArguments]
	 */
	public generate(generateId: number, bDirectSceneChild = false, parentPropArguments?: ISceneChildPropArguments): void {
		if (this.buffer && (this.bStatic || (generateId === this.generateId && !this.bUseParent && !this.bUseRecursion))) {
			return
		}

		this.generateId = generateId

		if (!this.bStaticIndexed || !this.bIndexed) this.indexedBuffer = []

		// prettier-ignore
		const repetition: IRepetition = {
			type: ERepetitionType.Ring, angle: 0, index: 1, offset: 1, count: 1,
			row: { index: 1, offset: 1, count: 1 },
			col: { index: 1, offset: 1, count: 1 },
		}

		const propArguments: ISceneChildPropArguments = {
			repetition,
			shape: this,
			parent: parentPropArguments,
		}

		const repetitions = this.getProp('repetitions', propArguments, 1)

		const repetitionType = Array.isArray(repetitions) ? ERepetitionType.Matrix : ERepetitionType.Ring
		const repetitionCount = Array.isArray(repetitions)
			? repetitions[0] * (repetitions[1] ?? repetitions[0])
			: repetitions

		const repetitionRowCount: number = Array.isArray(repetitions) ? repetitions[0] : repetitionCount
		const repetitionColCount: number = Array.isArray(repetitions) ? repetitions[1] ?? repetitions[0] : 1

		const rowRepetition = repetition.row
		rowRepetition.count = repetitionRowCount
		const colRepetition = repetition.col
		colRepetition.count = repetitionColCount

		repetition.count = repetitionCount
		repetition.col.count = repetitionColCount
		repetition.row.count = repetitionRowCount
		repetition.type = repetitionType

		let totalBufferLength = 0

		const buffers = []
		let currentIndex = 0
		const centerMatrix = vec2.fromValues((repetitionColCount - 1) / 2, (repetitionRowCount - 1) / 2)
		const sceneCenter: vec3 = this.scene ? [this.scene.center[0], this.scene.center[1], 0] : [0, 0, 0]

		const tmpTotalShapeBounding = [undefined, undefined, undefined, undefined]
		const tmpSingleRepetitionBounding = [undefined, undefined, undefined, undefined]

		for (let currentRowRepetition = 0; currentRowRepetition < repetitionRowCount; currentRowRepetition++) {
			for (
				let currentColRepetition = 0;
				currentColRepetition < repetitionColCount;
				currentColRepetition++, currentIndex++
			) {
				repetition.index = currentIndex + 1
				repetition.offset = repetitionCount > 1 ? currentIndex / (repetitionCount - 1) : 1

				repetition.angle = repetitionType === ERepetitionType.Ring ? (PI2 / repetitionCount) * currentIndex : 0
				colRepetition.index = currentColRepetition + 1
				colRepetition.offset = repetitionColCount > 1 ? currentColRepetition / (repetitionColCount - 1) : 1
				rowRepetition.index = currentRowRepetition + 1
				rowRepetition.offset = repetitionRowCount > 1 ? currentRowRepetition / (repetitionRowCount - 1) : 1

				// Generate primitives buffer recursively
				const buffer: Float32Array = this.generateBuffer(generateId, propArguments)
				const bufferLength = buffer.length

				const bounding = this.getShapeBounding()

				buffers[currentIndex] = new Float32Array(bufferLength)
				totalBufferLength += bufferLength

				{
					const distance = glme.toVec2(this.getProp('distance', propArguments, glme.VEC2_ZERO))
					const displace = this.getProp('displace', propArguments, 0) as number
					const scale = glme.toVec3(this.getProp('scale', propArguments, glme.VEC2_ONE), 1)
					const translate = glme.toVec3(this.getProp('translate', propArguments, glme.VEC2_ZERO), 0)
					const skewX = this.getProp('skewX', propArguments, 0) as number
					const skewY = this.getProp('skewY', propArguments, 0) as number
					const squeezeX = this.getProp('squeezeX', propArguments, 0) as number
					const squeezeY = this.getProp('squeezeY', propArguments, 0) as number
					const rotateX = this.getProp('rotateX', propArguments, 0) as number
					const rotateY = this.getProp('rotateY', propArguments, 0) as number
					const rotateZ = this.getProp('rotateZ', propArguments, 0) as number
					const perspective = clamp(0, 1, this.getProp('perspective', propArguments, 0) as number)
					const perspectiveOrigin = glme.toVec3(this.getProp('perspectiveOrigin', propArguments, glme.VEC2_ZERO), 0)
					const transformOrigin = glme.toVec3(this.getProp('transformOrigin', propArguments, glme.VEC2_ZERO), 0)

					let offset: vec3

					switch (repetitionType) {
						case ERepetitionType.Ring:
							offset = vec3.fromValues(distance[0], 0, 0)
							vec3.rotateZ(offset, offset, glme.VEC3_ZERO, repetition.angle + displace)
							break
						case ERepetitionType.Matrix:
							offset = vec3.fromValues(
								distance[1] * (currentColRepetition - centerMatrix[0]),
								distance[0] * (currentRowRepetition - centerMatrix[1]),
								0
							)
							break
					}

					const perspectiveSize = perspective > 0 ? Math.max(bounding.width, bounding.height) / 2 : 1
					const perspectiveValue = perspective > 0 ? perspectiveSize + (1 - perspective) * (perspectiveSize * 10) : 0
					const bTransformOrigin = perspective !== 0 || transformOrigin[0] !== 0 || transformOrigin[1] !== 0
					const bPerspectiveOrigin = perspectiveOrigin[0] !== 0 || perspectiveOrigin[1] !== 0

					if (bTransformOrigin) {
						transformOrigin[0] *= bounding.width / 2
						transformOrigin[1] *= bounding.height / 2
						transformOrigin[2] = perspectiveValue
					}

					/**
					 * Create Matrices
					 */
					{
						/**
						 * Create Transformation matrix
						 */
						mat4.identity(transformMatrix)

						bTransformOrigin && mat4.translate(transformMatrix, transformMatrix, transformOrigin)
						if (translate[0] !== 0 || translate[1] !== 0) mat4.translate(transformMatrix, transformMatrix, translate)
						if (skewX !== 0 || skewY !== 0) {
							glme.fromSkew(tmpMatrix, [skewX, skewY])
							mat4.multiply(transformMatrix, transformMatrix, tmpMatrix)
						}
						rotateX !== 0 && mat4.rotateX(transformMatrix, transformMatrix, rotateX)
						rotateY !== 0 && mat4.rotateY(transformMatrix, transformMatrix, rotateY)
						rotateZ !== 0 && mat4.rotateZ(transformMatrix, transformMatrix, rotateZ)
						if (scale[0] !== 1 || scale[1] !== 1) mat4.scale(transformMatrix, transformMatrix, scale)
						bTransformOrigin &&
							mat4.translate(transformMatrix, transformMatrix, vec3.scale(transformOrigin, transformOrigin, -1))

						/**
						 * Create Perspective matrix
						 */
						if (perspectiveValue > 0) {
							if (bPerspectiveOrigin) {
								perspectiveOrigin[0] *= bounding.width / 2
								perspectiveOrigin[1] *= bounding.height / 2
								perspectiveOrigin[2] = 0
							}
							mat4.perspective(perspectiveMatrix, -Math.PI / 2, 1, 0, Infinity)
						}

						/**
						 * Create Repetition matrix
						 */
						mat4.identity(repetitionMatrix)
						mat4.translate(repetitionMatrix, repetitionMatrix, offset)
						if (bDirectSceneChild) {
							mat4.translate(repetitionMatrix, repetitionMatrix, sceneCenter)
						}
						if (repetitionType === ERepetitionType.Ring)
							mat4.rotateZ(repetitionMatrix, repetitionMatrix, repetition.angle + displace)
					}

					Bounding.clear(tmpSingleRepetitionBounding)
					// Apply matrices on vertex
					for (let bufferIndex = 0; bufferIndex < bufferLength; bufferIndex += 2) {
						const vertex: vec3 = [buffer[bufferIndex], buffer[bufferIndex + 1], perspectiveValue]

						{
							// Apply squeeze, can be insert into transformMatrix?
							squeezeX !== 0 && Vec2.squeezeX(vertex, squeezeX)
							squeezeY !== 0 && Vec2.squeezeY(vertex, squeezeY)

							// Apply transforms
							vec3.transformMat4(vertex, vertex, transformMatrix)

							// Apply perspective
							if (perspectiveValue > 0) {
								bPerspectiveOrigin && vec3.add(vertex, vertex, perspectiveOrigin)
								vec3.transformMat4(vertex, vertex, perspectiveMatrix)
								vec3.scale(vertex, vertex, perspectiveValue)
								bPerspectiveOrigin && vec3.sub(vertex, vertex, perspectiveOrigin)
							}

							// custom vertex manipulation
							if (this.vertexCallback) {
								const index = bufferIndex / 2
								const count = bufferLength / 2
								const vertexRepetition = {
									index: index + 1,
									count,
									offset: count > 1 ? index / (count - 1) : 1,
								}

								this.vertexCallback(vertex, vertexRepetition, propArguments)
							}

							// final, apply repetition matrix
							vec3.transformMat4(vertex, vertex, repetitionMatrix)
						}

						buffers[currentIndex][bufferIndex] = vertex[0]
						buffers[currentIndex][bufferIndex + 1] = vertex[1]

						// Bounding.add(tmpSingleRepetitionBounding, vertex[0], vertex[1])
						Bounding.add(tmpTotalShapeBounding, vertex[0], vertex[1])
					}
				}

				// Bounding.sum(tmpTotalShapeBounding, tmpSingleRepetitionBounding)

				// After buffer creation, add a frame into indexedBuffer if not static or update bounding
				// const singleRepetitionBounding = { cx: 0, cy: 0, x: -1, y: -1, width: 2, height: 2 }
				// Bounding.bind(singleRepetitionBounding, tmpSingleRepetitionBounding)

				if (!this.bStaticIndexed || !this.bIndexed) {
					this.addIndex(bufferLength, repetition)
				}
			}
		}

		Bounding.bind(this.bounding, tmpTotalShapeBounding)

		this.buffer = new Float32Array(totalBufferLength)
		for (let i = 0, offset = 0, len = buffers.length; i < len; offset += buffers[i].length, i++)
			this.buffer.set(buffers[i], offset)

		this.bIndexed = true
	}

	/**
	 * Return current shape (whit repetions) bounding
	 *
	 * @return {*}  {IShapeBounding}
	 */
	public getBounding(): IShapeBounding {
		return this.bounding
	}

	/**
	 * Return a single shape bounding
	 *
	 * @abstract
	 * @return {*}  {IShapeBounding}
	 */
	public abstract getShapeBounding(): IShapeBounding

	/**
	 * Add into indexedBuffer
	 *
	 * @protected
	 * @abstract
	 * @param {number} frameLength
	 * @param {IRepetition} currentRepetition
	//  * @param {IShapeBounding} singleRepetitionBounding
	 * @returns {number} nextIndex
	 */
	protected abstract addIndex(
		frameLength: number,
		currentRepetition: IRepetition
	): // singleRepetitionBounding: IShapeBounding
	void

	/**
	 * Get number of repetitions
	 *
	 * @returns {number}
	 */
	public getRepetitionCount(): number {
		const repetitions = this.getProp('repetitions', undefined, 1)

		return Array.isArray(repetitions) ? repetitions[0] * (repetitions[1] ?? repetitions[0]) : repetitions
	}

	/**
	 * Return a buffer of children shape or loop generated buffer
	 *
	 * @protected
	 * @param {number} generateId
	 * @param {ISceneChildPropArguments} propArguments
	 * @returns {Float32Array}
	 */
	protected abstract generateBuffer(generateId: number, propArguments: ISceneChildPropArguments): Float32Array

	/**
	 *
	 *
	 * @abstract
	 * @param {(any)} shapeOrLoopOrBuffer
	 */
	public abstract setShape(shapeOrLoopOrBuffer: any): void

	/**
	 * Return buffer
	 *
	 * @returns {(Float32Array | undefined)}
	 */
	public getBuffer(): Float32Array | undefined {
		return this.buffer
	}

	/**
	 * Return indexed buffer
	 *
	 * @returns {(Array<IBufferIndex> | undefined)}
	 */
	public getIndexedBuffer(): Array<IBufferIndex> {
		return this.indexedBuffer
	}

	/**
	 * Return number of encapsulation
	 *
	 * @param {IBufferIndex} index
	 * @returns {number}
	 */
	static getIndexParentLevel(index: IBufferIndex): number {
		if (typeof index.parent === 'undefined') return 0

		let currentParent: IParentBufferIndex = index.parent
		let currentParentLevel = 1

		while (typeof currentParent.parent !== 'undefined') {
			currentParentLevel++
			currentParent = currentParent.parent
		}

		return currentParentLevel
	}

	/**
	 * Stream buffer
	 *
	 * @param {(TStreamCallback} callback
	 */
	public stream(callback: (streamArguments: IStreamArguments) => void): void {
		if (this.buffer && this.indexedBuffer) {
			for (let i = 0, j = 0, len = this.indexedBuffer.length; i < len; i++) {
				const currentIndexing: IBufferIndex = this.indexedBuffer[i]

				callback({
					buffer: this.buffer,
					frameLength: currentIndexing.frameLength,
					frameBufferIndex: j,
					currentIndexing: currentIndexing,
					currentShapeIndex: i,
					totalShapes: len,
				})

				j += currentIndexing.frameLength
			}
		}
	}
}

export default ShapeBase
