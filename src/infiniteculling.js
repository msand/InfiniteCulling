// ==ClosureCompiler==
// @compilation_level ADVANCED_OPTIMIZATIONS
// ==/ClosureCompiler==
/*jslint browser: true, nomen: true, plusplus: true, vars: true, bitwise: true, sub: true*/
/*global define, exports, module*/
/*eslint quotes: [1, "single"], dot-notation: [0] */
//noinspection ThisExpressionReferencesGlobalObjectJS
(function immediatelyInvokedFunctionExpression(root, factory) {
    'use strict';

    /*jshint sub: true*/
    // jscs:disable requireDotNotation

    var InfiniteCulling = factory();
    if (typeof define === 'function' && define['amd']) { // Advanced closure compiler optimization support
        // AMD. Register as an anonymous module.
        define([], function definer() {
            root['InfiniteCulling'] = InfiniteCulling; // Advanced closure compiler optimization support
            return InfiniteCulling;
        });
    } else if (typeof exports === 'object') {
        // Node. Only works with CommonJS-like environments that support module.exports, like Node.
        module['exports'] = InfiniteCulling; // Advanced closure compiler optimization support
    } else {
        // Browser globals
        root['InfiniteCulling'] = InfiniteCulling; // Advanced closure compiler optimization support
    }

    // jscs:enable

}(this, function factory() {
    'use strict';

    /*
     *  InfiniteCulling - Dependency free (ECMAScript 5.1) Culling algorithm for 2D DOM and Canvas objects.
     *
     *  - init
     *    - store elements and current min/max of x,y
     *    - store sorted lists of left, right, top, bottom edges of bounding boxes
     *    - find index of first possibly visible element in each list
     *    - take intersection of possibly visible indices and make visible
     *
     *  - move
     *    - if min of x,y decreases or max of x,y increases then show elements from index until first non-visible
     *    - if min of x,y increases or max of x,y decreases then hide elements from index until first visible
     *
     *  - add
     *    - add new/removed element to culling
     *
     *  - remove
     *    - remove element from culling
     *
     *  - update
     *    - remove element from culling, update bounds, add element again
     */

    var VALUE = 0,
        INDEX = 1;

    function gte(a, b) {
        return a >= b;
    }

    function lt(a, b) {
        return a < b;
    }

    function gt(a, b) {
        return a > b;
    }

    function lte(a, b) {
        return a <= b;
    }

    function getIndex(node) {
        return node[INDEX];
    }

    function getValue(node) {
        return node[VALUE];
    }

    function getTop(node) {
        return node.top;
    }

    function getLeft(node) {
        return node.left;
    }

    function getRight(node) {
        return node.right;
    }

    function getBottom(node) {
        return node.bottom;
    }

    function findBack(list, start, value, comparator) {
        var i = start - 1;

        while (i >= 0 && !comparator(getValue(list[i]), value)) {
            i--;
        }

        return i + 1;
    }

    function findFront(list, start, value, comparator) {
        var i = start,
            l = list.length;

        while (i < l && !comparator(getValue(list[i]), value)) {
            i++;
        }

        return i;
    }

    // returns indices of elements in representation list starting from index
    function getIndicesFrom(list, index, toIndex) {
        return list.slice(index, toIndex).map(getIndex);
    }

    function cmpAsc(a, b) {
        return getValue(a) - getValue(b);
    }

    function cmpDsc(a, b) {
        return getValue(b) - getValue(a);
    }

    // returns sorted list containing [value, index] for current direction (sorted by value)
    function getRepresentations(getter, list, reverse) {
        return list.map(
            function getRepresentation(node, index) {
                return [getter(node), index];
            }
        ).sort(reverse ? cmpDsc : cmpAsc);
    }

    function setMightChange(mightChange) {
        return function setElementMightChange(elementIndex) {
            mightChange[elementIndex] = true;
        };
    }

    function getObjectWithIndexProperties(list, toIndex) {
        var indices = {},
            mightChange = setMightChange(indices);

        getIndicesFrom(list, 0, toIndex).forEach(mightChange);

        return indices;
    }

    function checkDirection(front, list, first, limit, comparator, mightChange) {
        var newFirst = (front ? findFront : findBack)(list, first, limit, comparator);

        getIndicesFrom(list, front ? first : newFirst, front ? newFirst : first).forEach(mightChange);

        return newFirst;
    }

    function bisectLeft(a, c) {
        var mid,
            lo = 0,
            hi = a.length;

        while (lo < hi) {
            mid = lo + hi >>> 1;
            if (getValue(a[mid]) < c) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }

        return lo;
    }

    function bisectRight(a, c) {
        var mid,
            lo = 0,
            hi = a.length;

        while (lo < hi) {
            mid = lo + hi >>> 1;
            if (c > getValue(a[mid])) {
                hi = mid;
            } else {
                lo = mid + 1;
            }
        }

        return lo;
    }

    function findIndexOfNode(list, node) {
        var ni = list.indexOf(node),
            i,
            l;

        if (ni === -1) {
            for (i = 0, l = list.length; i < l; i++) {
                if (list[i].element === node) {
                    ni = i;
                    break;
                }
            }
        }

        return ni;
    }

    function removeNodeFromList(array, ni) {
        var f, i, l;
        for (f = -1, i = 0, l = array.length; i < l; i++) {
            if (getIndex(array[i]) === ni) {
                array.splice(i, 1);
                f = i;
                break;
            }
        }
        return f;
    }

    /**
     * @constructor
     */
    function InfiniteCulling() {
        // list of elements to cull
        var list, left, right, top, bottom, // bounds of view
            tops, lefts, rights, bottoms, // lists of edges of elements
            firstTop, firstLeft, firstRight, firstBottom; // index of first visible edges

        function isVisible(node) {
            return node.left <= right && node.right >= left && node.top <= bottom && node.bottom >= top;
        }

        function setVisible(index) {
            var node = list[index];
            node.element.style.visibility = isVisible(node) ? 'visible' : 'hidden';
        }

        function setInitialVisible() {
            // get possibly visible indices
            var t = getObjectWithIndexProperties(tops, firstTop),
                l = getObjectWithIndexProperties(lefts, firstLeft),
                r = getObjectWithIndexProperties(rights, firstRight),
                b = getObjectWithIndexProperties(bottoms, firstBottom);

            Object.keys(t).forEach(function makeVisible(index) {
                if (l.hasOwnProperty(index) && r.hasOwnProperty(index) && b.hasOwnProperty(index)) {
                    list[index].element.style.visibility = 'visible';
                }
            });
        }

        // initialize and cull visible elements
        function init(elements, bounds, setInitial) {
            // store elements and current min/max of x,y
            list = elements;
            top = bounds.top;
            left = bounds.left;
            right = bounds.right;
            bottom = bounds.bottom;

            // store sorted lists of left, right, top, bottom edges of bounding boxes
            tops = getRepresentations(getTop, list, false);
            lefts = getRepresentations(getLeft, list, false);
            rights = getRepresentations(getRight, list, true);
            bottoms = getRepresentations(getBottom, list, true);

            // find index of first non-visible element in each list
            firstTop = bisectLeft(tops, bottom);
            firstLeft = bisectLeft(lefts, right);
            firstRight = bisectRight(rights, left);
            firstBottom = bisectRight(bottoms, top);

            if (setInitial) {
                setInitialVisible();
            }
        }

        function move(newTop, newLeft, newRight, newBottom) {
            var indices = {},
                increasing = false,
                mightChange = setMightChange(indices);

            if (newTop !== top) {
                increasing = newTop < top;
                firstBottom = checkDirection(increasing, bottoms, firstBottom, newTop, increasing ? lt : gte, mightChange);
            }

            if (newLeft !== left) {
                increasing = newLeft < left;
                firstRight = checkDirection(increasing, rights, firstRight, newLeft, increasing ? lt : gte, mightChange);
            }

            if (newRight !== right) {
                increasing = newRight > right;
                firstLeft = checkDirection(increasing, lefts, firstLeft, newRight, increasing ? gt : lte, mightChange);
            }

            if (newBottom !== bottom) {
                increasing = newBottom > bottom;
                firstTop = checkDirection(increasing, tops, firstTop, newBottom, increasing ? gt : lte, mightChange);
            }

            top = newTop;
            left = newLeft;
            right = newRight;
            bottom = newBottom;

            Object.keys(indices).forEach(setVisible);
        }

        function add(node) {
            var t = node.top,
                l = node.left,
                r = node.right,
                b = node.bottom,
                ni = list.indexOf(node),
                ti = bisectLeft(tops, t),
                li = bisectLeft(lefts, l),
                ri = bisectRight(rights, r),
                bi = bisectRight(bottoms, b);

            if (ni === -1) {
                ni = list.length;
                list.push(node);
            }

            tops.splice(ti, 0, [t, ni]);
            lefts.splice(li, 0, [l, ni]);
            rights.splice(ri, 0, [r, ni]);
            bottoms.splice(bi, 0, [b, ni]);

            if (ti < firstTop) {
                firstTop++;
            }
            if (li < firstLeft) {
                firstLeft++;
            }
            if (ri < firstRight) {
                firstRight++;
            }
            if (bi < firstBottom) {
                firstBottom++;
            }

            setVisible(ni);
        }

        function removeNodeFromLists(ni) {
            var f = removeNodeFromList(tops, ni);
            if (f !== -1 && f < firstTop) {
                firstTop--;
            }
            f = removeNodeFromList(lefts, ni);
            if (f !== -1 && f < firstLeft) {
                firstLeft--;
            }
            f = removeNodeFromList(rights, ni);
            if (f !== -1 && f < firstRight) {
                firstRight--;
            }
            f = removeNodeFromList(bottoms, ni);
            if (f !== -1 && f < firstBottom) {
                firstBottom--;
            }
        }

        function remove(node) {
            var ni = findIndexOfNode(list, node);

            if (ni === -1) {
                return null;
            }

            removeNodeFromLists(ni);

            return list[ni];
        }

        function update(node, updateBounds) {
            var nodeRepresentation = remove(node) || node;

            if (updateBounds) {
                updateBounds(nodeRepresentation);
            }

            add(nodeRepresentation);
        }

        // Expose public api
        // jscs:disable requireDotNotation
        this['init'] = init; // Closure compiler requires bracket notation here
        // jscs:enable
        this.move = move;
        this.add = add;
        this.remove = remove;
        this.update = update;
    }

    return InfiniteCulling;
}));
