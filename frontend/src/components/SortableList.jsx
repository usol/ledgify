import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// 드래그 핸들(≡)을 렌더링하기 위한 내부 컴포넌트.
// renderItem(item, handle) 의 handle 을 핸들 엘리먼트에 spread 하면 그 부분으로만 드래그된다.
function SortableRow({ item, renderItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {renderItem(item, { ...attributes, ...listeners })}
    </div>
  );
}

/**
 * 세로 정렬 가능한 리스트.
 * - items: [{ id, ... }]
 * - onReorder(newItems): 드롭 후 재배열된 items 배열을 전달
 * - renderItem(item, handle): 각 행 렌더. handle 을 드래그 핸들 엘리먼트에 spread.
 * - wrapperClassName: 리스트 컨테이너 클래스
 */
export default function SortableList({ items, onReorder, renderItem, wrapperClassName = "space-y-2" }) {
  const sensors = useSensors(
    // 데스크톱: 5px 이상 움직여야 드래그 시작(클릭/버튼과 충돌 방지)
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // 모바일: 길게 눌러 드래그(스크롤과 충돌 방지)
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className={wrapperClassName}>
          {items.map((item) => (
            <SortableRow key={item.id} item={item} renderItem={renderItem} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// 공통 드래그 핸들 아이콘 (handle props 를 spread 해서 사용)
export function DragHandle({ handle, className = "" }) {
  return (
    <button
      type="button"
      {...handle}
      aria-label="드래그하여 순서 변경"
      className={`cursor-grab touch-none select-none px-1 text-gray-300 hover:text-gray-500 active:cursor-grabbing ${className}`}
    >
      ⠿
    </button>
  );
}
