'use client';

interface ProjectSubjectTagProps {
  /**
   * The contents of this tag.
   */
  label: string;

  /**
   * The hex code for the background color to this tag.
   *
   * This must not include a transparency value.
   */
  color?: string;
}

export default function ProjectSubjectTag({
  label,
  color,
}: ProjectSubjectTagProps) {
  return (
    <span
      className="inline-block py-2 px-3 mr-2"
      style={{
        // TODO: Find a more efficient way of doing this
        backgroundColor: (color ? color : projectTagToColor(label)) + '80',
      }}
    >
      {label}
    </span>
  );
}

function projectTagToColor(subject: string) {
  // TODO: Find an obviously better way of fixing this.
  switch (subject) {
    case 'Computer Vision':
      return '#FFD23F';
    case 'Natural Language Processing':
      return '#3BCEAC';
    default:
      return '#FFD23F';
  }
}
