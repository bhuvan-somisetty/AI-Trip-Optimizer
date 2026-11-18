import { interpolate, useTransform, type MotionValue } from "framer-motion";

// Scroll-linked mapping computed in JS. The array form of useTransform can be handed to the
// browser's native scroll timeline, which maps ranges against the wrong offsets for pinned sections.
export function useScrollRange(value: MotionValue<number>, input: number[], output: number[]): MotionValue<number>;
export function useScrollRange(value: MotionValue<number>, input: number[], output: string[]): MotionValue<string>;
export function useScrollRange(value: MotionValue<number>, input: number[], output: number[] | string[]): MotionValue<number> | MotionValue<string> {
  return useTransform(value, (v) => interpolate(input, output as number[])(v));
}
