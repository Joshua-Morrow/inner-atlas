/**
 * PartsMapNode — SVG node for the Parts Map canvas.
 * Renders the correct shape per part type, with optional image inset,
 * chain indicator (burdened state), label, and selection ring.
 *
 * NOTE: onPress is NOT used here. Tap detection is handled by PartsMapCanvas
 * via PanResponder + canvas coordinate hit testing, which is more reliable
 * than SVG onPress when PanResponder owns all touch events.
 */

import { memo } from 'react';
import {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Image as SvgImage,
  Path,
  Text as SvgText,
} from 'react-native-svg';

import { MapPart } from '@/lib/database';
import {
  DEV_CHAIN_STYLE,
  brokenShacklePath,
  getHangingLinks,
  getNodeColor,
  getNodeSize,
  hexagonPath,
  invertedTrianglePath,
  nodeBottomY,
  roundedSquarePath,
  shieldPath,
} from '@/lib/map-nodes';

interface Props {
  part: MapPart;
  x: number;
  y: number;
  isSelected: boolean;
  isDragging: boolean;
  dimmed?: boolean;
  chainPositions?: number[];
}

const PartsMapNode = memo(({ part, x, y, isSelected, isDragging, dimmed, chainPositions }: Props) => {
  const isFreed    = part.type === 'freed';
  const isSelf     = part.type === 'self';
  const isShadowed = part.status === 'shadowed' || part.status === 'unknown';

  const size        = getNodeSize(part.type, part.intensity ?? 5);
  const color       = isShadowed ? '#2A2927' : getNodeColor(part.type, isFreed);
  const strokeColor = isShadowed ? '#3A3835' : (isSelected ? '#FFFFFF' : color);
  const strokeWidth = isSelected ? 2.5 : 1.5;
  const baseOpacity = isShadowed ? 0.5 : 1;
  const opacity     = dimmed ? baseOpacity * 0.35 : baseOpacity;

  const clipId = `clip-${part.id}`;
  const botY   = nodeBottomY(part.type, size);

  // Which path string to use for non-circular shapes
  const isCircular = isSelf || isFreed;
  const isTriangle = part.type === 'unknown';
  const shapePath: string = (() => {
    if (isCircular || isTriangle) return '';
    switch (part.type) {
      case 'manager':     return hexagonPath(size);
      case 'firefighter': return shieldPath(size);
      case 'exile':       return roundedSquarePath(size);
      default:            return roundedSquarePath(size);
    }
  })();

  // Selection ring path (slightly larger)
  const selRingPath: string = (() => {
    if (isCircular || isTriangle) return '';
    const s2 = size + 4;
    switch (part.type) {
      case 'manager':     return hexagonPath(s2);
      case 'firefighter': return shieldPath(s2);
      default:            return roundedSquarePath(s2);
    }
  })();

  // Chain: exiles always show it; manager/firefighter show it when is_burdened
  const renderChain = !isFreed && !isSelf && !isShadowed &&
    (part.type === 'exile' || part.is_burdened === 1);

  // Label text
  const rawLabel    = isShadowed ? '' : (part.display_name ?? '');
  const displayLabel = rawLabel.length > 12 ? rawLabel.slice(0, 11) + '…' : rawLabel;

  // Badge indicators
  const showElaborated = part.is_elaborated === 1 && !isShadowed;
  const showRefined    = part.is_refined === 1 && !isShadowed;

  return (
    <G transform={`translate(${x}, ${y})`} opacity={opacity}>
      <Defs>
        <ClipPath id={clipId}>
          {isCircular ? (
            <Circle cx={0} cy={0} r={size - 1} />
          ) : isTriangle ? (
            <Path d={invertedTrianglePath(size)} />
          ) : (
            <Path d={shapePath} />
          )}
        </ClipPath>
      </Defs>

      {/* Self glow ring */}
      {isSelf && (
        <Circle
          cx={0} cy={0} r={size + 8}
          fill="none"
          stroke="#B88A00"
          strokeWidth={3}
          strokeOpacity={0.25}
        />
      )}

      {/* Main fill */}
      {isCircular ? (
        <Circle
          cx={0} cy={0} r={size}
          fill={part.circle_uri ? 'transparent' : color}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      ) : isTriangle ? (
        <Path
          d={invertedTrianglePath(size)}
          fill={color}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      ) : (
        <Path
          d={shapePath}
          fill={part.circle_uri ? 'transparent' : color}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      )}

      {/* Image inset */}
      {part.circle_uri && !isShadowed && (
        <>
          {/* Color tint behind image */}
          {isCircular ? (
            <Circle cx={0} cy={0} r={size} fill={color} />
          ) : !isTriangle ? (
            <Path d={shapePath} fill={color} />
          ) : null}

          <SvgImage
            x={-size}
            y={-size}
            width={size * 2}
            height={size * 2}
            href={part.circle_uri}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="xMidYMid slice"
            opacity={0.85}
          />

          {/* Stroke on top of image */}
          {isCircular ? (
            <Circle
              cx={0} cy={0} r={size}
              fill="transparent"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
          ) : !isTriangle ? (
            <Path
              d={shapePath}
              fill="transparent"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
          ) : null}
        </>
      )}

      {/* Selection ring */}
      {isSelected && (
        isCircular ? (
          <Circle
            cx={0} cy={0} r={size + 4}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={1.5}
            strokeOpacity={0.6}
          />
        ) : !isTriangle && selRingPath ? (
          <Path
            d={selRingPath}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={1.5}
            strokeOpacity={0.6}
          />
        ) : null
      )}

      {/* Drag highlight ring */}
      {isDragging && (
        isCircular ? (
          <Circle
            cx={0} cy={0} r={size + 8}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeOpacity={0.9}
          />
        ) : !isTriangle ? (
          (() => {
            const s3 = size + 8;
            const dragPath = (() => {
              switch (part.type) {
                case 'manager':     return hexagonPath(s3);
                case 'firefighter': return shieldPath(s3);
                default:            return roundedSquarePath(s3);
              }
            })();
            return (
              <Path
                d={dragPath}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={2}
                strokeOpacity={0.9}
              />
            );
          })()
        ) : null
      )}

      {/* Chain indicator — hanging links */}
      {renderChain && DEV_CHAIN_STYLE === 'hanging-links' && (
        getHangingLinks(botY).map((link, i) => (
          <Ellipse
            key={i}
            cx={link.cx}
            cy={link.cy}
            rx={link.rx}
            ry={link.ry}
            fill="none"
            stroke={color}
            strokeWidth={2}
            opacity={0.8 - i * 0.15}
          />
        ))
      )}

      {/* Chain indicator — broken shackle */}
      {renderChain && DEV_CHAIN_STYLE === 'broken-shackle' && (
        <Path
          d={brokenShacklePath(botY)}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      )}

      {/* Label — below node (or inside Self) */}
      {!isShadowed && displayLabel.length > 0 && (
        <SvgText
          x={0}
          y={isSelf
            ? 4
            : botY + (renderChain
                ? (DEV_CHAIN_STYLE === 'hanging-links' ? 46 : 32)
                : 14)}
          textAnchor="middle"
          fontSize={isSelf ? 13 : 11}
          fontWeight={isSelf ? '700' : '500'}
          fill={isSelf ? '#B88A00' : '#E8E6E1'}
          letterSpacing={0.3}
        >
          {displayLabel}
        </SvgText>
      )}

      {/* Shadowed label */}
      {isShadowed && (
        <SvgText
          x={0}
          y={botY + 14}
          textAnchor="middle"
          fontSize={9}
          fill="#6B6860"
          fontStyle="italic"
        >
          {'?'}
        </SvgText>
      )}

      {/* Badge — elaborated (dot at lower-right) */}
      {showElaborated && (
        <Circle
          cx={size * 0.7}
          cy={size * 0.7}
          r={4}
          fill={color}
          stroke="#1A1917"
          strokeWidth={1}
        />
      )}

      {/* Badge — refined (diamond at upper-right) */}
      {showRefined && (
        <Path
          d={`M ${size * 0.7},${-size * 0.7 - 5} L ${size * 0.7 + 3},${-size * 0.7} L ${size * 0.7},${-size * 0.7 + 5} L ${size * 0.7 - 3},${-size * 0.7} Z`}
          fill={color}
          stroke="#1A1917"
          strokeWidth={1}
        />
      )}

      {/* Badge — chain position (upper-right corner, above refined diamond) */}
      {chainPositions && chainPositions.length > 0 && !isShadowed && (
        <>
          <Circle
            cx={size * 0.75}
            cy={-size * 0.85}
            r={8}
            fill="#B88A00"
            stroke="#1A1917"
            strokeWidth={1.5}
          />
          <SvgText
            x={size * 0.75}
            y={-size * 0.85 + 3}
            textAnchor="middle"
            fontSize={8}
            fontWeight="700"
            fill="#FFFFFF"
          >
            {chainPositions[0]}
          </SvgText>
          {chainPositions.length > 1 && (
            <Circle
              cx={size * 0.75 + 10}
              cy={-size * 0.85}
              r={5}
              fill="#8A6A00"
              stroke="#1A1917"
              strokeWidth={1}
            />
          )}
        </>
      )}

    </G>
  );
});

export default PartsMapNode;
