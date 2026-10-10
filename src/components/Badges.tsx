import { Link } from 'react-router';
import { levelTitle, topicById } from '../data/topics';
import type { Level, TopicId } from '../data/types';

export function LevelBadge({ level }: { level: Level }) {
  return <span className={`badge badge--${level}`}>{levelTitle[level]}</span>;
}

export function TopicTag({ topic, link = false }: { topic: TopicId; link?: boolean }) {
  const title = topicById[topic].title;
  if (!link) return <span className="topic-tag">{title}</span>;
  return (
    <Link className="topic-tag topic-tag--link" to={`/questions?topic=${topic}`}>
      {title}
    </Link>
  );
}
