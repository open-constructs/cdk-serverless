"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReverseIndex_SK = exports.ReverseIndex_PK = exports.ReverseIndexName = void 0;
const tb = __importStar(require("@taimos/lambda-toolbox/lib/dynamodb"));
exports.ReverseIndexName = 'ReverseIndex';
exports.ReverseIndex_PK = tb.Primary_SK;
exports.ReverseIndex_SK = tb.Primary_PK;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFibGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdHlwZXMvdGFibGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHdFQUEwRDtBQUU3QyxRQUFBLGdCQUFnQixHQUFHLGNBQWMsQ0FBQztBQUNsQyxRQUFBLGVBQWUsR0FBRyxFQUFFLENBQUMsVUFBVSxDQUFDO0FBQ2hDLFFBQUEsZUFBZSxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyB0YiBmcm9tICdAdGFpbW9zL2xhbWJkYS10b29sYm94L2xpYi9keW5hbW9kYic7XG5cbmV4cG9ydCBjb25zdCBSZXZlcnNlSW5kZXhOYW1lID0gJ1JldmVyc2VJbmRleCc7XG5leHBvcnQgY29uc3QgUmV2ZXJzZUluZGV4X1BLID0gdGIuUHJpbWFyeV9TSztcbmV4cG9ydCBjb25zdCBSZXZlcnNlSW5kZXhfU0sgPSB0Yi5QcmltYXJ5X1BLO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNpbmdsZVRhYmxlRGVzaWduIHtcblxuICAvKipcbiAgICogQ3JlYXRlIHJldmVyc2UgR1NJIG5hbWVkICdSZXZlcnNlSW5kZXgnIGFuZCBTSyBhcyBwYXJ0aXRpb24ga2V5IGFuZCBQSyBhcyBzb3J0IGtleVxuICAgKlxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgcmV2ZXJzZUdTST86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFRoZSBuYW1lIG9mIFRUTCBhdHRyaWJ1dGUuXG4gICAqXG4gICAqIEBkZWZhdWx0IC0gVFRMIGlzIGRpc2FibGVkXG4gICAqL1xuICB0aW1lVG9MaXZlQXR0cmlidXRlPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBhZGRpdGlvbmFsIGdsb2JhbCBzZWNvbmRhcnkgaW5kZXhlc1xuICAgKi9cbiAgYWRkaXRpb25hbEdsb2JhbEluZGV4ZXM/OiB7XG4gICAgW25hbWU6IHN0cmluZ106IHtcbiAgICAgIHBhcnRpdGlvbktleTogc3RyaW5nO1xuICAgICAgc29ydEtleT86IHN0cmluZztcbiAgICB9O1xuICB9O1xuXG4gIC8qKlxuICAgKiBsb2NhbCBzZWNvbmRhcnkgaW5kZXhlc1xuICAgKi9cbiAgbG9jYWxJbmRleGVzPzoge1xuICAgIFtuYW1lOiBzdHJpbmddOiB7XG4gICAgICBzb3J0S2V5OiBzdHJpbmc7XG4gICAgfTtcbiAgfTtcbn1cbiJdfQ==