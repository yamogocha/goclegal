"use client"
import { motion } from "framer-motion";
import { ReactNode } from "react";
import { Motions } from "./welcome";

type variantType = {
	initial: { opacity?: number; x?: number; y?: number };
	whileInView: { opacity?: number; x?: number; y?: number };
};
const variants: Record<Motions, variantType> = {
    fadeUp: { initial: { opacity: 0 , y: 40 }, whileInView: { opacity: 1, y: 0 }},
    fadeIn: { initial: { opacity: 0 }, whileInView: { opacity: 1 }},
    fadeRight: { initial: { opacity: 0 , x: -40 }, whileInView: { opacity: 1, x: 0 }},
    fadeLeft: { initial: { opacity: 0 , x: 40 }, whileInView: { opacity: 1, x: 0 }},
}

type MotionType = {
    type?: Motions,
    children: ReactNode
    className?: string
}
export default function MotionWrapper({
    type = Motions.FADEIN,
    children,
    className,
}: MotionType) {
    
    const variant = variants[type]
    return (
        <motion.div
            initial={variant.initial}
            whileInView={variant.whileInView}
            transition={{ duration: .8, ease: "easeOut" }}
            viewport={{ once: false, amount: .3 }}
            className={className}
        >
            {children}
        </motion.div>
    )
}