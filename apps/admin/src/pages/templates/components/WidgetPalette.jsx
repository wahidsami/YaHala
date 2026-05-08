import { useDraggable } from '@dnd-kit/core';
import { Type, Image, Calendar, QrCode, User, BookOpen } from 'lucide-react';
import { WIDGET_TYPES, WIDGET_CATEGORIES } from '../widgetConfig';
import './WidgetPalette.css';

const ICONS = {
    Type, Image, Calendar, QrCode, User, BookOpen
};

function DraggableWidget({ type, label, icon }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: type,
        data: { fromPalette: true, widgetType: type }
    });

    const Icon = ICONS[icon] || Type;

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={`palette-widget ${isDragging ? 'dragging' : ''}`}
        >
            <Icon size={18} />
            <span>{label}</span>
        </div>
    );
}

export default function WidgetPalette() {
    return (
        <div className="widget-palette">
            <h3>Widgets</h3>

            {WIDGET_CATEGORIES.map(category => (
                <div key={category.id} className="palette-category">
                    <h4>{category.label}</h4>
                    <div className="palette-widgets">
                        {WIDGET_TYPES.filter(w => w.category === category.id).map(widget => (
                            <DraggableWidget
                                key={widget.type}
                                type={widget.type}
                                label={widget.label}
                                icon={widget.icon}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
