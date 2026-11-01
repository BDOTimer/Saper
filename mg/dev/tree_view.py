import os
import sys
from pathlib import Path
import subprocess
import platform

def collect_tree_lines(directory, prefix="", filter_exts=None, show_hidden=False):
    """
    Рекурсивно собирает строки дерева директории в список.
    
    Args:
        directory: путь к директории
        prefix: префикс для форматирования (используется в рекурсии)
        filter_exts: список расширений для фильтрации (например, [".cs", ".java"])
        show_hidden: показывать ли скрытые файлы/папки
    
    Returns:
        list: список строк дерева
    """
    if filter_exts is None:
        filter_exts = [".cs"]
    
    lines = []
    
    try:
        # Получаем список элементов в директории
        items = list(Path(directory).iterdir())
        
        # Фильтруем скрытые файлы/папки если нужно
        if not show_hidden:
            items = [item for item in items if not item.name.startswith('.')]
        
        # Разделяем на папки и файлы
        dirs = sorted([item for item in items if item.is_dir()])
        files = sorted([item for item in items if item.is_file()])
        
        # Фильтруем файлы по расширениям
        files = [f for f in files if f.suffix in filter_exts]
        
        # Объединяем папки и файлы (сначала папки, потом файлы)
        all_items = dirs + files
        
        # Проходим по всем элементам
        for i, item in enumerate(all_items):
            is_last = (i == len(all_items) - 1)
            
            # Выбираем символ для отображения
            connector = "└── " if is_last else "├── "
            
            # Добавляем элемент с префиксом
            if item.is_dir():
                lines.append(f"{prefix}{connector}{item.name}/")
                # Рекурсивно обходим поддиректорию
                extension = "    " if is_last else "│   "
                lines.extend(collect_tree_lines(item, prefix + extension, filter_exts, show_hidden))
            else:
                lines.append(f"{prefix}{connector}{item.name}")
                
    except PermissionError:
        lines.append(f"{prefix}└── [Ошибка доступа]")
    except Exception as e:
        lines.append(f"{prefix}└── [Ошибка: {e}]")
    
    return lines

def count_items(directory, filter_exts=None, show_hidden=False):
    """
    Подсчитывает количество файлов с указанными расширениями и папок.
    
    Returns:
        tuple: (количество файлов, количество папок)
    """
    if filter_exts is None:
        filter_exts = [".cs"]
    
    file_count = 0
    dir_count = 0
    
    try:
        items = list(Path(directory).iterdir())
        
        if not show_hidden:
            items = [item for item in items if not item.name.startswith('.')]
        
        for item in items:
            if item.is_dir():
                dir_count += 1
                sub_files, sub_dirs = count_items(item, filter_exts, show_hidden)
                file_count += sub_files
                dir_count += sub_dirs
            elif item.is_file() and item.suffix in filter_exts:
                file_count += 1
                
    except (PermissionError, Exception):
        pass
    
    return file_count, dir_count

def print_tree(directory, prefix="", filter_exts=None, show_hidden=False, output_file=None):
    """
    Рекурсивно выводит дерево директории с фильтром файлов по расширению.
    
    Args:
        directory: путь к директории
        prefix: префикс для форматирования (используется в рекурсии)
        filter_exts: список расширений для фильтрации
        show_hidden: показывать ли скрытые файлы/папки
        output_file: файл для записи (если None, выводит в консоль)
    """
    if filter_exts is None:
        filter_exts = [".cs"]
    
    lines = collect_tree_lines(directory, prefix, filter_exts, show_hidden)
    
    # Выводим в консоль или записываем в файл
    if output_file:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
    else:
        for line in lines:
            print(line)

def open_file(filepath):
    """
    Открывает файл в стандартном редакторе в зависимости от ОС.
    """
    try:
        system = platform.system()
        if system == 'Windows':
            os.startfile(filepath)
        elif system == 'Darwin':  # macOS
            subprocess.run(['open', filepath])
        else:  # Linux и другие
            subprocess.run(['xdg-open', filepath])
        return True
    except Exception as e:
        print(f"⚠️ Не удалось открыть файл: {e}")
        return False

def parse_extensions(ext_str):
    """
    Парсит строку с расширениями в список.
    Поддерживает форматы: ".cs,.java,.py" или "cs,java,py"
    """
    if not ext_str:
        return [".cs"]
    
    # Разделяем по запятой
    extensions = [e.strip() for e in ext_str.split(',') if e.strip()]
    
    # Добавляем точку если её нет
    extensions = [e if e.startswith('.') else f'.{e}' for e in extensions]
    
    return extensions

def main():
    # Парсим аргументы командной строки
    root_dir = "."
    output_file = None
    show_hidden = False
    auto_open = False
    filter_exts = [".cs"]  # расширения по умолчанию
    
    i = 1
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == "-o" or arg == "--output":
            if i + 1 < len(sys.argv):
                output_file = sys.argv[i + 1]
                i += 2
            else:
                print("Ошибка: не указано имя файла для вывода")
                return
        elif arg == "-e" or arg == "--ext":
            if i + 1 < len(sys.argv):
                filter_exts = parse_extensions(sys.argv[i + 1])
                i += 2
            else:
                print("Ошибка: не указаны расширения")
                return
        elif arg == "--open":
            auto_open = True
            i += 1
        elif arg == "-h" or arg == "--help":
            print("""
Использование: python script.py [путь] [опции]

Опции:
  -o, --output <файл>    Сохранить результат в текстовый файл
  -e, --ext <расширения> Фильтр по расширениям (через запятую)
                         Примеры: -e .cs,.java,.py
                                  -e cs,java,py
  --open                 Автоматически открыть созданный файл
  --hidden               Показывать скрытые файлы и папки
  -h, --help             Показать эту справку

Примеры:
  python script.py                              # Показать дерево (.cs файлы)
  python script.py -e .cs,.java                 # Фильтр .cs и .java файлы
  python script.py -e cs,java,py                # Фильтр .cs, .java и .py
  python script.py -o tree.txt -e .cs,.js      # Сохранить .cs и .js файлы
  python script.py /project -e .cpp,.h --open  # .cpp и .h с открытием
  python script.py -e .txt,.md --hidden        # .txt и .md со скрытыми
            """)
            return
        elif arg == "--hidden":
            show_hidden = True
            i += 1
        else:
            root_dir = arg
            i += 1
    
    # Если не указан файл вывода и auto_open, используем имя по умолчанию
    if output_file is None and auto_open:
        output_file = "project_tree.txt"
        print(f"ℹ️ Файл вывода не указан, используется: {output_file}")
    
    # Проверяем существование директории
    if not os.path.exists(root_dir):
        print(f"Ошибка: директория '{root_dir}' не найдена")
        return
    
    if not os.path.isdir(root_dir):
        print(f"Ошибка: '{root_dir}' не является директорией")
        return
    
    # Формируем строку для отображения фильтра
    filter_str = ', '.join(filter_exts)
    
    # Подсчитываем количество файлов и папок
    file_count, dir_count = count_items(Path(root_dir), filter_exts, show_hidden)
    
    # Определяем, куда выводить результат
    if output_file:
        print(f"📁 {os.path.basename(root_dir)}/ (фильтр: {filter_str})")
        print(f"Сохраняем в файл: {output_file}")
        print("=" * 50)
        print(f"📊 Статистика: {file_count} файлов, {dir_count} папок")
        print("=" * 50)
        
        # Собираем строки дерева
        lines = collect_tree_lines(Path(root_dir), "", filter_exts, show_hidden)
        
        # Добавляем заголовок
        header = [
            f"📁 {os.path.basename(root_dir)}/ (фильтр: {filter_str})",
            "=" * 50,
            f"📊 Статистика: {file_count} файлов, {dir_count} папок",
            "=" * 50
        ]
        
        # Записываем в файл
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(header + lines))
        
        # Выводим в консоль подтверждение
        print(f"✅ Дерево успешно сохранено в '{output_file}'")
        print(f"Всего строк: {len(header + lines)}")
        
        # Автоматически открываем файл если указано
        if auto_open:
            print(f"📂 Открываем файл: {output_file}")
            open_file(output_file)
    else:
        # Выводим в консоль
        print(f"📁 {os.path.basename(root_dir)}/ (фильтр: {filter_str})")
        print("=" * 50)
        print(f"📊 Статистика: {file_count} файлов, {dir_count} папок")
        print("=" * 50)
        print_tree(Path(root_dir), "", filter_exts, show_hidden)

if __name__ == "__main__":
    main()