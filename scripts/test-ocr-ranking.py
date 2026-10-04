"""Exercise the actual report handler without loading heavyweight OCR models."""
import ast
import pathlib
import re
import unittest
from unittest.mock import Mock

source = pathlib.Path(__file__).resolve().parents[1] / 'cloud_run' / 'server.py'
handler = next(n for n in ast.parse(source.read_text(encoding='utf-8')).body
               if isinstance(n, ast.FunctionDef) and n.name == 'report')
handler.decorator_list = []


class RankingTests(unittest.TestCase):
    def run_report(self, quantities, invalid=(), blank=()):
        codes = [f'MSG4TS{i:04d}' for i in range(len(quantities))]
        reads = []

        def read_code(rect):
            i = rect['top'] - 2
            reads.append(i)
            return {'code': '' if i in invalid else codes[i]}

        env = dict(
            image_from_request=lambda: (None, ''),
            table_grid=lambda _: dict(ys=list(range(len(quantities)+3)), data_start=2,
                                      code=(0, 10), quantity=(10, 20)),
            rect_from_bounds=lambda x1, x2, y1, y2: dict(left=x1, top=y1, width=x2-x1, height=y2-y1),
            crop_cell=lambda img, rect: rect,
            crop_quantity_cell=lambda img, rect: rect,
            cell_has_content=lambda rect: rect['top'] - 2 not in blank,
            recognize_quantity=lambda rect: (quantities[rect['top']-2], []),
            recognize_code=read_code,
            CODE_RE=re.compile(r'^M[SK][A-Z][0-9][A-Z]{2}[0-9]{4}$'),
            jsonify=lambda data: data,
            traceback=Mock(),
        )
        exec(compile(ast.Module(body=[handler], type_ignores=[]), str(source), 'exec'), env)
        return env['report'](), reads, codes

    def test_sorted_fast_code_path(self):
        result, reads, codes = self.run_report([9, 8, 7, 6, 5, 4, 3, 2])
        self.assertEqual([r['code'] for r in result['storeRanking']], codes[:5])
        self.assertEqual(reads, [0, 1, 2, 3, 4])

    def test_unsorted_late_best_and_stable_ties(self):
        result, reads, codes = self.run_report([1, 4, 3, 4, 2, 9, 8, 4])
        self.assertEqual([r['code'] for r in result['storeRanking']], [codes[i] for i in [5, 6, 1, 3, 7]])
        self.assertEqual([r['rank'] for r in result['storeRanking']], [1, 2, 3, 4, 5])
        self.assertEqual(len(reads), 5)

    def test_ascending(self):
        result, _, _ = self.run_report([1, 2, 3, 4, 5, 6, 7])
        self.assertEqual([r['quantity'] for r in result['storeRanking']], [7, 6, 5, 4, 3])

    def test_total_and_blank_excluded(self):
        result, _, _ = self.run_report([99, 9, 8, 7, 6, 5, None], invalid=(0, 6))
        self.assertEqual([r['quantity'] for r in result['storeRanking']], [9, 8, 7, 6, 5])

    def test_unreadable_product_quantity_fails(self):
        result, _, _ = self.run_report([9, 8, 7, 6, 5, None])
        self.assertEqual(result[1], 400)

    def test_blank_rows_need_no_ocr(self):
        result, reads, _ = self.run_report([9, 8, 7, 6, 5, None, None], blank=(5, 6))
        self.assertEqual(len(result['storeRanking']), 5)
        self.assertEqual(reads, [0, 1, 2, 3, 4])

    def test_too_few_products_fails(self):
        result, _, _ = self.run_report([9, 8, 7, 6, 5], invalid=(4,))
        self.assertEqual(result[1], 400)


if __name__ == '__main__':
    unittest.main()
