
import React, { useRef, useState, useEffect, useCallback, ReactNode, MouseEventHandler, UIEvent } from 'react';
import { motion, useInView } from 'framer-motion';

interface AnimatedItemProps {
    children: ReactNode;
    delay?: number;
    index: number;
    onMouseEnter?: MouseEventHandler<HTMLDivElement>;
    onClick?: MouseEventHandler<HTMLDivElement>;
    className?: string;
}

const AnimatedItem: React.FC<AnimatedItemProps> = ({ children, delay = 0, index, onMouseEnter, onClick, className = "" }) => {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { amount: 0.2, once: true });
    return (
        <motion.div
            ref={ref}
            data-index={index}
            onMouseEnter={onMouseEnter}
            onClick={onClick}
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={inView ? { y: 0, opacity: 1, scale: 1 } : { y: 20, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, delay, ease: [0.23, 1, 0.32, 1] }}
            className={`cursor-pointer ${className}`}
        >
            {children}
        </motion.div>
    );
};

interface AnimatedListProps {
    items: any[];
    renderItem: (item: any, index: number, isSelected: boolean) => ReactNode;
    onItemSelect?: (item: any, index: number) => void;
    showGradients?: boolean;
    enableArrowNavigation?: boolean;
    className?: string;
    containerClassName?: string;
    displayScrollbar?: boolean;
    initialSelectedIndex?: number;
    gap?: number;
}

const AnimatedList: React.FC<AnimatedListProps> = ({
    items = [],
    renderItem,
    onItemSelect,
    showGradients = true,
    enableArrowNavigation = true,
    className = '',
    containerClassName = '',
    displayScrollbar = true,
    initialSelectedIndex = -1,
    gap = 12
}) => {
    const listRef = useRef<HTMLDivElement>(null);
    const [selectedIndex, setSelectedIndex] = useState<number>(initialSelectedIndex);
    const [keyboardNav, setKeyboardNav] = useState<boolean>(false);
    const [topGradientOpacity, setTopGradientOpacity] = useState<number>(0);
    const [bottomGradientOpacity, setBottomGradientOpacity] = useState<number>(1);

    const handleItemMouseEnter = useCallback((index: number) => {
        setSelectedIndex(index);
    }, []);

    const handleItemClick = useCallback(
        (item: any, index: number) => {
            setSelectedIndex(index);
            if (onItemSelect) {
                onItemSelect(item, index);
            }
        },
        [onItemSelect]
    );

    const handleScroll = (e: UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target as HTMLDivElement;
        setTopGradientOpacity(Math.min(scrollTop / 50, 1));
        const bottomDistance = scrollHeight - (scrollTop + clientHeight);
        setBottomGradientOpacity(scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / 50, 1));
    };

    useEffect(() => {
        if (!enableArrowNavigation || items.length === 0) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
                e.preventDefault();
                setKeyboardNav(true);
                setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
            } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
                e.preventDefault();
                setKeyboardNav(true);
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter') {
                if (selectedIndex >= 0 && selectedIndex < items.length) {
                    e.preventDefault();
                    if (onItemSelect) {
                        onItemSelect(items[selectedIndex], selectedIndex);
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [items, selectedIndex, onItemSelect, enableArrowNavigation]);

    useEffect(() => {
        if (!keyboardNav || selectedIndex < 0 || !listRef.current) return;
        const container = listRef.current;
        const selectedItem = container.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement | null;
        if (selectedItem) {
            const extraMargin = 50;
            const containerScrollTop = container.scrollTop;
            const containerHeight = container.clientHeight;
            const itemTop = selectedItem.offsetTop;
            const itemBottom = itemTop + selectedItem.offsetHeight;
            if (itemTop < containerScrollTop + extraMargin) {
                container.scrollTo({ top: itemTop - extraMargin, behavior: 'smooth' });
            } else if (itemBottom > containerScrollTop + containerHeight - extraMargin) {
                container.scrollTo({
                    top: itemBottom - containerHeight + extraMargin,
                    behavior: 'smooth'
                });
            }
        }
        setKeyboardNav(false);
    }, [selectedIndex, keyboardNav]);

    return (
        <div className={`relative ${containerClassName}`}>
            <div
                ref={listRef}
                className={`overflow-y-auto custom-scrollbar h-full ${className} ${!displayScrollbar ? 'scrollbar-hide' : ''}`}
                onScroll={handleScroll}
            >
                {items.map((item, index) => (
                    <AnimatedItem
                        key={index}
                        delay={index * 0.05}
                        index={index}
                        onMouseEnter={() => handleItemMouseEnter(index)}
                        onClick={() => handleItemClick(item, index)}
                    >
                        {renderItem(item, index, selectedIndex === index)}
                    </AnimatedItem>
                ))}
            </div>
            {/* Gradients removed for plain look */}
        </div>
    );
};

export default AnimatedList;
