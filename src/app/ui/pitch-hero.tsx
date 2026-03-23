// components/Hero.tsx
'use client'; // Client component for Framer Motion + form interactivity

import { useForm, ValidationError } from '@formspree/react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState } from 'react';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            when: 'beforeChildren',
            staggerChildren: 0.2, // Stagger bullets by 200ms
            delayChildren: 0.3,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: 'easeOut' },
    },
};

const headlineVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.8, ease: 'easeOut' } },
};

interface HeroProps {
    formspreeEndpoint?: string; // Optional override
    title?: string;
}

export default function Hero({
                                 formspreeEndpoint = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT || '',
                                 title = 'xFinance',
                             }: HeroProps) {
    const [state, handleSubmit] = useForm(formspreeEndpoint);
    const [showSuccess, setShowSuccess] = useState(false);

    if (state.succeeded) {
        if (!showSuccess) setShowSuccess(true);
    }

    return (
        <section className="relative py-20 md:py-32 overflow-hidden">
            {/* Cool yellow/gold lightning bolt glow overlay (subtle radial gradient) */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-slate-900 to-black opacity-80" />
            <div className="absolute inset-0 bg-gradient-radial from-amber-500/10 via-transparent to-transparent pointer-events-none" />

            <div className="container mx-auto px-6 lg:px-8 relative z-10">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={containerVariants}
                    >
                        {/* Branding */}
                        <motion.div variants={itemVariants} className="mb-8">
                            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
                                {title}
                            </h1>
                            <p className="mt-2 text-xl md:text-2xl text-emerald-400 font-medium">
                                Powered by xAI
                            </p>
                        </motion.div>

                        {/* Headline */}
                        <motion.h2
                            variants={headlineVariants}
                            className="text-4xl md:text-6xl font-extrabold leading-tight mb-6"
                        >
                            Generate Consistent Income.
                            <br className="hidden sm:block" />
                            Spend Just 30–60 Minutes a Week.
                        </motion.h2>

                        {/* Tagline */}
                        <motion.p
                            variants={itemVariants}
                            className="text-2xl md:text-3xl font-semibold text-emerald-300 mb-8"
                        >
                            No Atoms Moved — Just Gains Earned.
                        </motion.p>

                        {/* Subheadline */}
                        <motion.p
                            variants={itemVariants}
                            className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto"
                        >
                            Hassle-free options income for high-net-worth individuals and RIAs. Let AI deliver vetted wheel, covered call, and LEAP recommendations — review, approve, and delegate the rest.
                        </motion.p>

                        {/* Core 3-Bullet Value Prop – staggered */}
                        <motion.div
                            variants={containerVariants}
                            className="grid md:grid-cols-3 gap-8 mb-16 text-left"
                        >
                            <motion.div variants={itemVariants} className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl border border-gray-700">
                                <h3 className="text-xl font-bold text-emerald-400 mb-3">Ultra-Low Time Commitment</h3>
                                <p className="text-gray-300">
                                    1–2 personalized trade ideas per week with rationale, sizing, risk flags, and order previews. Approve in minutes — no charting or scanning required.
                                </p>
                            </motion.div>

                            <motion.div variants={itemVariants} className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl border border-gray-700">
                                <h3 className="text-xl font-bold text-emerald-400 mb-3">Hassle-Free & Delegated Execution</h3>
                                <p className="text-gray-300">
                                    Broker-ready previews, conservative defaults, conflict detection, and confidence scoring. Like having a reliable junior trader handling the details.
                                </p>
                            </motion.div>

                            <motion.div variants={itemVariants} className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl border border-gray-700">
                                <h3 className="text-xl font-bold text-emerald-400 mb-3">Peace of Mind for Serious Portfolios</h3>
                                <p className="text-gray-300">
                                    Built for $500K–$10M+ accounts. RIAs get compliance exports, audit trails, risk alerts, and override controls — defensible yield enhancement.
                                </p>
                            </motion.div>
                        </motion.div>

                        {/* CTA Area */}
                        <motion.div
                            variants={containerVariants}
                            className="flex flex-col sm:flex-row justify-center gap-6 mb-16"
                        >
                            <Link
                                href="/api/auth/x/login" // Your Next.js auth route for X login
                                className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-5 px-10 rounded-full text-xl transition transform hover:scale-105 shadow-lg"
                            >
                                Get Early Access – Login with X
                            </Link>

                            {/* Formspree Waitlist Form */}
                            {!showSuccess ? (
                                <form
                                    onSubmit={handleSubmit}
                                    className="w-full max-w-md mx-auto sm:mx-0"
                                >
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder="Your email"
                                        required
                                        className="w-full px-6 py-4 mb-4 bg-gray-800 border border-gray-700 rounded-full text-gray-100 placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                                    />
                                    <ValidationError prefix="Email" field="email" errors={state.errors} className="text-red-400 text-sm mb-2" />

                                    <textarea
                                        name="message"
                                        placeholder="Optional: Tell us about your portfolio size or RIA needs"
                                        rows={2}
                                        className="w-full px-6 py-4 mb-4 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                                    />
                                    <button
                                        type="submit"
                                        disabled={state.submitting}
                                        className="w-full bg-transparent border-2 border-emerald-500 text-emerald-400 hover:bg-emerald-500/20 font-bold py-5 px-10 rounded-full text-xl transition disabled:opacity-50"
                                    >
                                        {state.submitting ? 'Submitting...' : 'Join Waitlist / Inquire'}
                                    </button>
                                </form>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-emerald-400 font-semibold text-xl"
                                >
                                    Thanks! We've received your interest — check your inbox soon.
                                </motion.div>
                            )}
                        </motion.div>

                        {/* Disclaimer */}
                        <motion.p variants={itemVariants} className="text-sm text-gray-500 mt-8">
                            Not financial advice. Always consult your advisor. Strategies involve risk of loss. Designed for accredited investors and RIAs.
                        </motion.p>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}